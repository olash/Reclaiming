/**
 * Local stand-in for every third-party service Reclaimng talks to, so the API
 * routes and the UI can be exercised end to end without real credentials,
 * real money or real identity data.
 *
 *   Supabase   /auth/v1/*  /rest/v1/*  /storage/v1/*
 *   Paystack   /__paystack/*
 *   QoreID     /__qoreid/*
 *   Mono       /__mono/*
 *   Test admin /__admin/*   (seed / inspect / reset state)
 *
 * The database half enforces the schema in supabase/migrations (columns,
 * NOT NULL, CHECK, UNIQUE) and a simplified version of the RLS policies, so
 * schema drift between the code and the migrations shows up as a failing call
 * here exactly as it would against real PostgREST.
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT || 54321);
export const SERVICE_KEY = 'mock-service-role-key';
export const ANON_KEY = 'mock-anon-key';
export const PAYSTACK_SECRET = 'sk_test_mock';

// ── Schema (mirrors the SQL migrations) ───────────────────────────────────
const SCHEMA_V1 = {
  verifications: {
    columns: ['id', 'user_id', 'nin', 'profile_data', 'created_at'],
    required: ['user_id', 'nin', 'profile_data'],
    unique: ['nin'],
    rls: 'owner',
  },
  estates: {
    columns: [
      'id', 'user_id', 'estate_name', 'deceased_name', 'status', 'paystack_reference',
      'death_certificate_path', 'letter_of_administration_path', 'submitted_at', 'updated_at',
      'discovered_accounts', 'payment_status', 'mandate_acknowledged',
    ],
    required: ['user_id', 'paystack_reference', 'death_certificate_path'],
    defaults: () => ({
      estate_name: 'Unknown Estate', deceased_name: 'Unknown', status: 'pending_review',
      letter_of_administration_path: null, discovered_accounts: [], payment_status: 'unpaid',
      mandate_acknowledged: false, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }),
    checks: {
      status: ['pending_review', 'under_review', 'verified', 'rejected'],
      payment_status: ['unpaid', 'paid', 'refunded'],
    },
    rls: 'owner',
  },
  bvn_request_logs: {
    columns: ['id', 'user_id', 'ip_address', 'bvn', 'status', 'created_at'],
    required: ['bvn', 'status'],
    rls: 'service-only',
  },
};

// Schema after supabase/migrations/0005_redesign.sql has been applied.
const SCHEMA_V2 = {
  ...SCHEMA_V1,
  estates: {
    ...SCHEMA_V1.estates,
    columns: [
      ...SCHEMA_V1.estates.columns,
      'date_of_death', 'relationship', 'review_note', 'total_asset_value', 'discovery_completed_at',
      'document_check',
    ],
    unique: ['paystack_reference'],
    checks: {
      status: ['pending_review', 'under_review', 'verified', 'rejected', 'settled'],
      payment_status: ['unpaid', 'paid', 'refunded'],
    },
  },
  payments: {
    columns: ['id', 'user_id', 'estate_id', 'reference', 'purpose', 'amount_kobo', 'status', 'created_at'],
    required: ['user_id', 'reference', 'purpose', 'amount_kobo'],
    unique: ['reference'],
    defaults: () => ({ status: 'used', estate_id: null }),
    checks: { purpose: ['identity', 'submission'] },
    rls: 'owner-read',
  },
  bvn_request_logs: {
    columns: ['id', 'user_id', 'ip_address', 'bvn_hash', 'bvn', 'status', 'created_at'],
    required: ['status'],
    rls: 'service-only',
  },
};

// "live": what the diagnostics found on the real project — migration 0004 never ran (no payment_status).
const SCHEMA_LIVE = {
  ...SCHEMA_V1,
  estates: {
    ...SCHEMA_V1.estates,
    columns: [...SCHEMA_V1.estates.columns.filter((c) => c !== 'payment_status'), 'total_asset_value'],
    defaults: () => { const d = SCHEMA_V1.estates.defaults(); delete d.payment_status; return d; },
    checks: { status: SCHEMA_V1.estates.checks.status },
  },
  payments: SCHEMA_V2.payments,
};
const pick = (name) => (name === 'v1' ? SCHEMA_V1 : name === 'live' ? SCHEMA_LIVE : SCHEMA_V2);
let SCHEMA = pick(process.env.MOCK_SCHEMA);

// ── State ─────────────────────────────────────────────────────────────────
const fresh = () => ({
  users: [],            // { id, email, password, user_metadata }
  tables: Object.fromEntries(Object.keys(SCHEMA_V2).map((t) => [t, []])),
  objects: new Map(),   // "bucket/path" -> { body: Buffer, contentType }
  paystackTx: new Map(),// reference -> { status, amount, currency, email, metadata }
  upstreamCalls: [],    // { service, path }
  monoSessions: new Map(),
});
let db = fresh();

// ── Fixtures for the identity / banking providers ─────────────────────────
const NIN_REGISTRY = {
  '11111111111': { firstname: 'Amaka', lastname: 'Okonkwo', birthdate: '1988-04-12', phone: '08012345678' },
  '22222222222': { firstname: 'Tunde', lastname: 'Bello', birthdate: '1979-09-30', phone: '08087654321' },
};
const BANK_ACCOUNTS = {
  '058:0123456789': 'ESTATE OF LATE SAMUEL BELLO',
  '058:1111111111': 'SAMUEL ADEKUNLE BELLO',
  '044:2222222222': 'TUNDE BELLO',          // a relative who shares only the surname
  '044:3333333333': 'CHIDI OKAFOR',
  '011:4444444444': 'REAL ESTATE VENTURES LTD',
};
const BVN_ACCOUNTS = {
  '12345678901': [
    { account_name: 'SAMUEL ADEKUNLE BELLO', account_number: '0123456789', account_type: 'SAVINGS', account_designation: 'INDIVIDUAL', institution: { name: 'GTBank', branch: '00012', bank_code: '058', nip_code: '000013' } },
    { account_name: 'SAMUEL ADEKUNLE BELLO', account_number: '2087654321', account_type: 'CURRENT', account_designation: 'INDIVIDUAL', institution: { name: 'First Bank', branch: '00301', bank_code: '011' } },
    { account_name: 'SAMUEL A BELLO', account_number: '0045671234', account_type: 'SAVINGS', account_designation: 'INDIVIDUAL', institution: { name: 'Access Bank', branch: '00077', bank_code: '044' } },
  ],
  '22345678901': [],
};

// ── Helpers ───────────────────────────────────────────────────────────────
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeJwt(user, ttl = 3600) {
  const head = b64u({ alg: 'HS256', typ: 'JWT' });
  const body = b64u({
    sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + ttl, iat: Math.floor(Date.now() / 1000),
    app_metadata: user.app_metadata || {}, user_metadata: user.user_metadata || {},
  });
  const sig = crypto.createHmac('sha256', 'mock-jwt-secret').update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function readJwt(token) {
  try {
    const [head, body, sig] = token.split('.');
    const expect = crypto.createHmac('sha256', 'mock-jwt-secret').update(`${head}.${body}`).digest('base64url');
    if (sig !== expect) return null;
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (claims.exp < Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
}
const publicUser = (u) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, phone: '',
  email_confirmed_at: u.created_at, created_at: u.created_at, updated_at: u.created_at,
  app_metadata: { provider: 'email', providers: ['email'], ...(u.app_metadata || {}) },
  user_metadata: u.user_metadata || {}, identities: [],
});
function session(user) {
  const refresh = crypto.randomBytes(12).toString('hex');
  user.refresh = refresh;
  return {
    access_token: makeJwt(user), token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: refresh, user: publicUser(user),
  };
}
export function createUser({ email, password = 'password123', user_metadata = {}, app_metadata = {}, id }) {
  const user = { id: id || crypto.randomUUID(), email, password, user_metadata, app_metadata, created_at: new Date().toISOString() };
  db.users.push(user);
  return user;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = body === undefined ? '' : isBuf ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': isBuf ? 'application/octet-stream' : 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
    'access-control-expose-headers': 'content-range',
    ...headers,
  });
  res.end(payload);
}
const pgError = (res, status, code, message) => send(res, status, { code, message, details: null, hint: null });

// ── PostgREST emulation ───────────────────────────────────────────────────
function caller(req) {
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (auth === SERVICE_KEY) return { role: 'service' };
  const claims = readJwt(auth);
  if (claims) return { role: 'user', id: claims.sub };
  return { role: 'anon' };
}
function parseFilters(search, table) {
  const filters = [];
  for (const [key, raw] of search) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    const m = /^(not\.)?(eq|neq|gte|gt|lte|lt|in|is)\.(.*)$/.exec(raw);
    if (!m) continue;
    if (!SCHEMA[table].columns.includes(key)) return { error: `column ${table}.${key} does not exist` };
    filters.push({ key, neg: !!m[1], op: m[2], val: m[3] });
  }
  return { filters };
}
function matches(row, { key, neg, op, val }) {
  const v = row[key];
  let ok;
  switch (op) {
    case 'eq': ok = String(v) === val; break;
    case 'neq': ok = String(v) !== val; break;
    case 'gte': ok = String(v) >= val; break;
    case 'gt': ok = String(v) > val; break;
    case 'lte': ok = String(v) <= val; break;
    case 'lt': ok = String(v) < val; break;
    case 'in': ok = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v)); break;
    case 'is': ok = val === 'null' ? v === null || v === undefined : String(v) === val; break;
    default: ok = true;
  }
  return neg ? !ok : ok;
}
function visibleRows(table, who) {
  const rows = db.tables[table];
  const rls = SCHEMA[table].rls;
  if (who.role === 'service') return rows;
  if (who.role !== 'user' || rls === 'service-only') return [];
  return rows.filter((r) => r.user_id === who.id);
}
function validateRow(table, row, { partial = false } = {}) {
  const def = SCHEMA[table];
  for (const k of Object.keys(row)) {
    if (!def.columns.includes(k)) return { status: 400, code: 'PGRST204', message: `Could not find the '${k}' column of '${table}' in the schema cache` };
  }
  if (!partial) for (const k of def.required) {
    if (row[k] === undefined || row[k] === null) return { status: 400, code: '23502', message: `null value in column "${k}" of relation "${table}" violates not-null constraint` };
  }
  for (const [k, allowed] of Object.entries(def.checks || {})) {
    if (row[k] !== undefined && !allowed.includes(row[k])) return { status: 400, code: '23514', message: `new row for relation "${table}" violates check constraint "${table}_${k}_check"` };
  }
  return null;
}
function project(row, select, table) {
  if (!select || select === '*') return row;
  const out = {};
  for (const col of select.split(',').map((s) => s.trim())) {
    if (!SCHEMA[table].columns.includes(col)) return { __error: `column ${table}.${col} does not exist` };
    out[col] = row[col] ?? null;
  }
  return out;
}

async function handleRest(req, res, url) {
  const table = url.pathname.split('/')[3];
  if (!SCHEMA[table]) return pgError(res, 404, 'PGRST205', `Could not find the table 'public.${table}' in the schema cache`);
  const who = caller(req);
  const prefer = req.headers.prefer || '';
  const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
  const { filters, error } = parseFilters(url.searchParams, table);
  if (error) return pgError(res, 400, '42703', error);
  const select = url.searchParams.get('select');

  const finish = (rows, status = 200) => {
    const projected = rows.map((r) => project(r, select, table));
    const bad = projected.find((r) => r.__error);
    if (bad) return pgError(res, 400, '42703', bad.__error);
    const headers = { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
    if (req.method === 'HEAD') return send(res, 200, undefined, headers);
    if (wantsObject) {
      if (projected.length !== 1) return pgError(res, 406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned');
      return send(res, status, projected[0], headers);
    }
    return send(res, status, projected, headers);
  };

  if (req.method === 'GET' || req.method === 'HEAD') {
    let rows = visibleRows(table, who).filter((r) => filters.every((f) => matches(r, f)));
    const order = url.searchParams.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1));
    }
    const limit = url.searchParams.get('limit');
    if (limit) rows = rows.slice(0, Number(limit));
    return finish(rows);
  }

  const body = JSON.parse((await readBody(req)).toString() || '{}');

  if (req.method === 'POST') {
    const def = SCHEMA[table];
    if (who.role === 'anon' || (who.role === 'user' && def.rls !== 'owner')) return pgError(res, 403, '42501', `new row violates row-level security policy for table "${table}"`);
    const inserted = [];
    for (const input of Array.isArray(body) ? body : [body]) {
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(def.defaults?.() || {}), ...input };
      if (!def.columns.includes('created_at')) delete row.created_at;
      const bad = validateRow(table, row);
      if (bad) return pgError(res, bad.status, bad.code, bad.message);
      if (who.role === 'user' && row.user_id !== who.id) return pgError(res, 403, '42501', `new row violates row-level security policy for table "${table}"`);
      for (const u of def.unique || []) {
        const cols = u.split('+');
        if (db.tables[table].some((r) => cols.every((c) => r[c] === row[c]))) return pgError(res, 409, '23505', `duplicate key value violates unique constraint "${table}_${u}_key"`);
      }
      db.tables[table].push(row);
      inserted.push(row);
    }
    if (prefer.includes('return=representation') || select) return finish(inserted, 201);
    return send(res, 201, undefined);
  }

  if (req.method === 'PATCH') {
    // Clients have no UPDATE grant on any table (see migration: "UPDATE + DELETE: Blocked").
    if (who.role !== 'service') return pgError(res, 403, '42501', `permission denied for table ${table}`);
    const bad = validateRow(table, body, { partial: true });
    if (bad) return pgError(res, bad.status, bad.code, bad.message);
    const rows = db.tables[table].filter((r) => filters.every((f) => matches(r, f)));
    for (const r of rows) Object.assign(r, body, SCHEMA[table].columns.includes('updated_at') ? { updated_at: new Date().toISOString() } : {});
    if (prefer.includes('return=representation') || select) return finish(rows);
    return send(res, 204, undefined);
  }
  return send(res, 405, { message: 'method not allowed' });
}

// ── GoTrue emulation ──────────────────────────────────────────────────────
async function handleAuth(req, res, url) {
  const path = url.pathname.replace('/auth/v1', '');
  const body = ['POST', 'PUT'].includes(req.method) ? JSON.parse((await readBody(req)).toString() || '{}') : {};
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (path === '/health') return send(res, 200, { name: 'GoTrue (mock)' });
  if (path === '/signup' && req.method === 'POST') {
    if (db.users.some((u) => u.email === body.email)) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
    if ((body.password || '').length < 8) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 8 characters' });
    const user = createUser({ email: body.email, password: body.password, user_metadata: body.data || {} });
    return send(res, 200, session(user));
  }
  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const user = db.users.find((u) => u.email === body.email && u.password === body.password);
      if (!user) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(res, 200, session(user));
    }
    if (grant === 'refresh_token') {
      const user = db.users.find((u) => u.refresh === body.refresh_token);
      if (!user) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      return send(res, 200, session(user));
    }
    return send(res, 400, { msg: 'unsupported grant' });
  }
  if (path === '/user') {
    const claims = readJwt(bearer);
    const user = claims && db.users.find((u) => u.id === claims.sub);
    if (!user) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT: unable to parse or verify signature' });
    if (req.method === 'PUT') {
      if (body.password) user.password = body.password;
      if (body.data) user.user_metadata = { ...user.user_metadata, ...body.data };
    }
    return send(res, 200, publicUser(user));
  }
  if (path === '/logout') return send(res, 204, undefined);
  if (path === '/recover') return send(res, 200, {});
  return send(res, 404, { msg: `mock gotrue: no route for ${req.method} ${path}` });
}

// ── Storage emulation ─────────────────────────────────────────────────────
async function handleStorage(req, res, url) {
  const m = /^\/storage\/v1\/object\/(?:authenticated\/|sign\/)?(.+)$/.exec(decodeURIComponent(url.pathname));
  if (!m) return send(res, 404, { message: 'not found' });
  const key = m[1];
  // Signed URLs: POST /object/sign/{bucket}/{path} → { signedURL }, then GET it with ?token=
  if (req.method === 'POST' && url.pathname.startsWith('/storage/v1/object/sign/')) {
    if (caller(req).role !== 'service') return send(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'signing needs the service key' });
    if (!db.objects.has(key)) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    return send(res, 200, { signedURL: `/object/sign/${key}?token=mock-signed` });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/storage/v1/object/sign/') && url.searchParams.get('token') === 'mock-signed') {
    const obj = db.objects.get(key);
    return obj ? send(res, 200, obj.body, { 'content-type': obj.contentType }) : send(res, 404, { message: 'not found' });
  }
  const who = caller(req);
  if (who.role === 'anon') return send(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
  const [, owner] = key.split('/');
  if (who.role === 'user' && owner !== who.id) return send(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
  if (req.method === 'POST' || req.method === 'PUT') {
    if (db.objects.has(key) && req.headers['x-upsert'] !== 'true') return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
    const raw = await readBody(req);
    db.objects.set(key, { body: raw, contentType: req.headers['content-type'] || 'application/octet-stream', size: raw.length });
    return send(res, 200, { Key: key, Id: crypto.randomUUID() });
  }
  if (req.method === 'GET') {
    const obj = db.objects.get(key);
    if (!obj) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    return send(res, 200, obj.body, { 'content-type': 'application/octet-stream' });
  }
  return send(res, 405, { message: 'method not allowed' });
}

// ── Paystack ──────────────────────────────────────────────────────────────
async function handlePaystack(req, res, url) {
  const path = url.pathname.replace('/__paystack', '');
  db.upstreamCalls.push({ service: 'paystack', path });
  if ((req.headers.authorization || '') !== `Bearer ${PAYSTACK_SECRET}`) return send(res, 401, { status: false, message: 'Invalid key' });
  if (path === '/bank/resolve') {
    const name = BANK_ACCOUNTS[`${url.searchParams.get('bank_code')}:${url.searchParams.get('account_number')}`];
    if (!name) return send(res, 422, { status: false, message: 'Could not resolve account name. Check parameters or try again.' });
    return send(res, 200, { status: true, message: 'Account number resolved', data: { account_number: url.searchParams.get('account_number'), account_name: name, bank_id: 9 } });
  }
  const tx = /^\/transaction\/verify\/(.+)$/.exec(path);
  if (tx) {
    const t = db.paystackTx.get(decodeURIComponent(tx[1]));
    if (!t) return send(res, 400, { status: false, message: 'Transaction reference not found.' });
    return send(res, 200, { status: true, message: 'Verification successful', data: { reference: tx[1], status: t.status, amount: t.amount, currency: t.currency || 'NGN', customer: { email: t.email }, metadata: t.metadata || {} } });
  }
  return send(res, 404, { status: false, message: 'mock paystack: unknown route' });
}

// ── QoreID ────────────────────────────────────────────────────────────────
async function handleQoreid(req, res, url) {
  const path = url.pathname.replace('/__qoreid', '');
  db.upstreamCalls.push({ service: 'qoreid', path });
  const body = JSON.parse((await readBody(req)).toString() || '{}');
  if (path === '/token') {
    if (body.clientId !== 'mock-qore-client' || body.secret !== 'mock-qore-secret') return send(res, 401, { message: 'Invalid credentials' });
    return send(res, 201, { accessToken: 'mock-qore-access-token', expiresIn: 7200, tokenType: 'Bearer' });
  }
  if (path === '/v1/sessions') {
    const expected = 'Basic ' + Buffer.from('mock-qore-client:mock-qore-secret').toString('base64');
    if (req.headers.authorization !== expected) return send(res, 401, { message: 'Unauthorized' });
    // Mirrors the live test account: liveness products enabled, face_verification_nin not subscribed.
    if (!['liveness', 'liveness_nin'].includes(body.productCode)) return send(res, 403, { statusCode: 403, message: 'Not subscribed to this product' });
    if (!body.reference) return send(res, 400, { message: 'reference is required' });
    return send(res, 201, { sessionId: 'sess_' + crypto.randomBytes(6).toString('hex'), sdkSessionToken: 'sdk_' + crypto.randomBytes(16).toString('hex'), type: 'collection', productCode: body.productCode, expiresAt: new Date(Date.now() + 600000).toISOString() });
  }
  if (req.headers.authorization !== 'Bearer mock-qore-access-token') return send(res, 401, { message: 'Unauthorized' });
  const premium = /^\/v1\/ng\/identities\/nin-premium\/(\d+)$/.exec(path);
  const basic = path === '/v1/ng/identities/nin';
  if (premium || basic) {
    const nin = premium ? premium[1] : body.idNumber;
    // Any NIN starting 11… is Amaka Okonkwo, 22… is Tunde Bello; anything else is unknown.
    const rec = NIN_REGISTRY[nin.slice(0, 2).repeat(6).slice(0, 11)];
    if (!rec) return send(res, 404, { statusCode: 404, message: 'NIN not found', error: 'Not Found' });
    const eq = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
    const fn = eq(body.firstname, rec.firstname), ln = eq(body.lastname, rec.lastname);
    const exact = premium ? fn && ln : false;
    return send(res, 200, {
      id: 99001, applicant: { firstname: body.firstname, lastname: body.lastname },
      summary: { nin_check: { status: exact ? 'EXACT_MATCH' : fn || ln ? 'PARTIAL_MATCH' : 'NO_MATCH', fieldMatches: { firstname: fn, lastname: ln } } },
      status: { state: 'complete', status: exact ? 'verified' : 'id_mismatch' },
      nin: { nin, ...rec, photo: 'BASE64PHOTO', residence: { address1: '12 Allen Avenue', lga: 'Ikeja', state: 'Lagos' } },
    });
  }
  return send(res, 404, { message: 'mock qoreid: unknown route' });
}

// ── Mono (BVN lookup / iGree) ─────────────────────────────────────────────
async function handleMono(req, res, url) {
  // Mirrors https://docs.mono.co/docs/lookup/bvn-igree (v3). Sandbox values: BVN 12345678901, OTP 123456, alternate phone 09066662020.
  const path = url.pathname.replace('/__mono', '');
  db.upstreamCalls.push({ service: 'mono', path });
  if (req.headers['mono-sec-key'] !== 'mock-mono-key') return send(res, 401, { status: 'failed', message: 'Please use a Lookup app, go to your dashboard and create an app with Lookup product.' });
  const body = JSON.parse((await readBody(req)).toString() || '{}');
  if (path.startsWith('/v2/')) return send(res, 404, { status: 'failed', message: 'Cannot POST ' + path });
  if (path === '/v3/lookup/bvn/initiate') {
    if (!(body.bvn in BVN_ACCOUNTS)) return send(res, 400, { status: 'failed', message: 'Invalid BVN' });
    if (body.scope !== 'bank_accounts') return send(res, 400, { status: 'failed', message: 'mock expects scope bank_accounts' });
    const id = crypto.randomUUID();
    db.monoSessions.set(id, { bvn: body.bvn, otpSent: false });
    return send(res, 200, {
      status: 'successful', message: 'BVN Lookup successfully initiated.',
      data: { session_id: id, methods: [
        { method: 'email', hint: 'An email with a verification code will be sent to sam***lo@gmail.com' },
        { method: 'phone', hint: 'SMS with a verification code will be sent to phone 0803***5678' },
        { method: 'alternate_phone', hint: 'SMS with a verification code will be sent to your alternate phone number' },
      ] },
    });
  }
  const sess = db.monoSessions.get(req.headers['x-session-id']);
  if (!sess) return send(res, 400, { status: 'failed', message: 'Invalid or expired session id' });
  if (path === '/v3/lookup/bvn/verify') {
    if (!['email', 'phone', 'phone_1', 'alternate_phone'].includes(body.method)) return send(res, 400, { status: 'failed', message: 'Invalid method' });
    if (body.method === 'alternate_phone' && !body.phone_number) return send(res, 400, { status: 'failed', message: 'phone_number is required' });
    sess.otpSent = true;
    const to = body.method === 'alternate_phone' ? body.phone_number : body.method === 'email' ? 'sam***lo@gmail.com' : '0803***5678';
    return send(res, 200, { status: 'successful', message: `Please enter the OTP that was sent to ${to}`, timestamp: new Date().toISOString(), data: null });
  }
  if (path === '/v3/lookup/bvn/details') {
    if (!sess.otpSent || body.otp !== '123456') return send(res, 400, { status: 'failed', message: 'Invalid OTP' });
    return send(res, 200, { status: 'successful', message: 'BVN bank accounts successfully fetched.', data: BVN_ACCOUNTS[sess.bvn] });
  }
  return send(res, 404, { message: 'mock mono: unknown route' });
}

// ── Test admin ────────────────────────────────────────────────────────────
async function handleAdmin(req, res, url) {
  const path = url.pathname.replace('/__admin', '');
  const body = req.method === 'POST' ? JSON.parse((await readBody(req)).toString() || '{}') : {};
  if (path === '/reset') { db = fresh(); if (body.schema) SCHEMA = pick(body.schema); return send(res, 200, { ok: true }); }
  if (path === '/user') { const u = createUser(body); return send(res, 200, { user: publicUser(u), session: session(u) }); }
  if (path === '/tx') { db.paystackTx.set(body.reference, body); return send(res, 200, { ok: true }); }
  if (path === '/row') { db.tables[body.table].push(body.row); return send(res, 200, { ok: true }); }
  if (path === '/patch') { const r = db.tables[body.table].find((x) => x.id === body.id); Object.assign(r, body.patch); return send(res, 200, r); }
  if (path === '/state') {
    return send(res, 200, {
      users: db.users.map(publicUser), tables: db.tables,
      objects: [...db.objects].map(([k, v]) => ({ key: k, size: v.size, contentType: v.contentType })),
      upstreamCalls: db.upstreamCalls,
    });
  }
  return send(res, 404, { message: 'unknown admin route' });
}

export function start(port = PORT) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    try {
      if (req.method === 'OPTIONS') return send(res, 204, undefined);
      if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url);
      if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url);
      if (url.pathname.startsWith('/storage/v1')) return await handleStorage(req, res, url);
      if (url.pathname.startsWith('/__paystack')) return await handlePaystack(req, res, url);
      if (url.pathname.startsWith('/__qoreid')) return await handleQoreid(req, res, url);
      if (url.pathname.startsWith('/__mono')) return await handleMono(req, res, url);
      if (url.pathname.startsWith('/__admin')) return await handleAdmin(req, res, url);
      return send(res, 404, { message: `mock: no route for ${req.method} ${url.pathname}` });
    } catch (err) {
      console.error('[mock] error', req.method, req.url, err);
      return send(res, 500, { message: String(err) });
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().then(() => console.log(`[mock] upstreams listening on http://127.0.0.1:${PORT}`));
}
