/**
 * End-to-end tests for every API route, run against the real Next.js server
 * with all third parties replaced by tests/mock/upstreams.mjs.
 *
 *   npm run test:serve     # terminal 1 — mock + app on :3000
 *   npm run test:api       # terminal 2
 */
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

const APP = process.env.APP_URL || 'http://127.0.0.1:3000';
const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:54321';
const SCHEMA = process.env.MOCK_SCHEMA || 'v2';

const admin = (path, body) => fetch(MOCK + '/__admin' + path, { method: 'POST', body: JSON.stringify(body || {}) }).then((r) => r.json());
const state = () => fetch(MOCK + '/__admin/state').then((r) => r.json());

async function call(path, { token, json, form, method = 'POST', headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (token) init.headers.authorization = `Bearer ${token}`;
  if (json !== undefined) {
    init.body = typeof json === 'string' ? json : JSON.stringify(json);
    init.headers['content-type'] = 'application/json';
  }
  if (form) init.body = form;
  const res = await fetch(APP + path, init);
  const type = res.headers.get('content-type') || '';
  const body = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, body, headers: res.headers };
}

let n = 0;
async function newUser(email) {
  const { user, session } = await admin('/user', { email: email || `user${++n}@example.com` });
  return { id: user.id, email: user.email, token: session.access_token };
}
const paid = (reference, amount, user, purpose, extra = {}) =>
  admin('/tx', { reference, status: 'success', amount, currency: 'NGN', email: user.email, metadata: { user_id: user.id, purpose }, ...extra });

const pdfFile = (text = '%PDF-1.4 death certificate') => new Blob([Buffer.from(text)], { type: 'application/pdf' });
function docForm(fields, files = { death_certificate: { blob: pdfFile(), name: 'death-certificate.pdf' } }) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const [k, v] of Object.entries(files)) f.append(k, v.blob, v.name);
  return f;
}

/** A user who has passed identity and has an approved case with the bank letter done. */
async function userWithEstate(patch = {}) {
  const user = await newUser();
  const id = crypto.randomUUID();
  await admin('/row', { table: 'verifications', row: { id: crypto.randomUUID(), user_id: user.id, nin: '11111111111', profile_data: { applicant: { firstname: 'Amaka', lastname: 'Okonkwo' } }, created_at: new Date().toISOString() } });
  await admin('/row', {
    table: 'estates',
    row: {
      id, user_id: user.id, estate_name: 'Estate of Samuel Adekunle Bello', deceased_name: 'Samuel Adekunle Bello', status: 'verified', payment_status: 'paid',
      paystack_reference: 'seed_' + id, death_certificate_path: `${user.id}/dc.pdf`, letter_of_administration_path: null, discovered_accounts: [],
      mandate_acknowledged: true, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch,
    },
  });
  return { user, estateId: id };
}
const estateRow = async (id) => (await state()).tables.estates.find((e) => e.id === id);

before(async () => {
  await admin('/reset', { schema: SCHEMA });
});

// ─────────────────────────────────────────────────────────────────────────
describe('every route refuses callers who are not signed in', () => {
  const routes = ['/api/verify-nin', '/api/generate-qore-session', '/api/update-milestone', '/api/igree/request-otp', '/api/igree/verify-otp', '/api/verify-estate-nuban', '/api/generate-inventory'];
  for (const path of routes) {
    test(`${path} → 401 with no token`, async () => {
      const r = await call(path, { json: {} });
      assert.equal(r.status, 401);
      assert.equal(r.body.code, 'UNAUTHENTICATED');
    });
    test(`${path} → 401 with a forged token`, async () => {
      const r = await call(path, { json: {}, token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXIifQ.x' });
      assert.equal(r.status, 401);
    });
  }
  test('/api/submit-documents → 401 with no token', async () => {
    const r = await call('/api/submit-documents', { form: docForm({ deceased_name: 'X Y', paystack_reference: 'x' }) });
    assert.equal(r.status, 401);
  });
  test('no upstream provider was contacted by any of the above', async () => {
    assert.equal((await state()).upstreamCalls.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('GET /api/config', () => {
  test('returns only public settings', async () => {
    const r = await call('/api/config', { method: 'GET' });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body).sort(), ['paystackPublicKey', 'supabaseAnonKey', 'supabaseUrl']);
    assert.ok(!JSON.stringify(r.body).includes('service'));
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/verify-nin', () => {
  let seq = 0;
  // A fresh NIN per test (the mock treats every 11… NIN as Amaka Okonkwo).
  const fresh = () => ({ nin: '11' + String(100000000 + ++seq), firstname: 'Amaka', lastname: 'Okonkwo', dob: '1988-04-12', phone: '08012345678' });
  let good;
  beforeEach(() => { good = fresh(); });

  test('rejects a NIN that is not 11 digits without calling the provider', async () => {
    const u = await newUser();
    const before = (await state()).upstreamCalls.length;
    for (const nin of ['123', 'abcdefghijk', '1111111111a', '']) {
      const r = await call('/api/verify-nin', { token: u.token, json: { ...good, nin } });
      assert.equal(r.status, 400, nin);
    }
    assert.equal((await state()).upstreamCalls.length, before);
  });

  test('requires a payment', async () => {
    const u = await newUser();
    const r = await call('/api/verify-nin', { token: u.token, json: good });
    assert.equal(r.status, 402);
    assert.equal(r.body.code, 'PAYMENT_REQUIRED');
  });

  test('rejects a made-up payment reference', async () => {
    const u = await newUser();
    const r = await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'FAKE_NEVER_PAID' } });
    assert.equal(r.status, 402);
    assert.equal(r.body.code, 'PAYMENT_NOT_FOUND');
  });

  test('rejects an underpayment, an abandoned payment and someone else\'s payment', async () => {
    const u = await newUser();
    const other = await newUser();
    await paid('ID_SHORT', 100, u, 'identity');
    await paid('ID_ABANDONED', 500000, u, 'identity', { status: 'abandoned' });
    await paid('ID_OTHERS', 500000, other, 'identity');
    assert.equal((await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_SHORT' } })).body.code, 'PAYMENT_AMOUNT_MISMATCH');
    assert.equal((await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_ABANDONED' } })).body.code, 'PAYMENT_INCOMPLETE');
    assert.equal((await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_OTHERS' } })).body.code, 'PAYMENT_OWNER_MISMATCH');
  });

  test('a mismatch never leaks the identity record, and does not burn the payment', async () => {
    const u = await newUser();
    await paid('ID_MISMATCH', 500000, u, 'identity');
    const wrong = await call('/api/verify-nin', { token: u.token, json: { ...good, firstname: 'Wrong', lastname: 'Person', payment_reference: 'ID_MISMATCH' } });
    assert.equal(wrong.status, 422);
    assert.equal(wrong.body.code, 'NAME_MISMATCH');
    const text = JSON.stringify(wrong.body);
    for (const secret of ['Allen Avenue', 'BASE64PHOTO', '1988-04-12', 'Okonkwo']) assert.ok(!text.includes(secret), `leaked ${secret}`);
    // the same payment still works once the name is corrected
    const right = await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_MISMATCH' } });
    assert.equal(right.status, 200);
    assert.equal(right.body.verified, true);
  });

  test('success stores a KYC record for the token\'s user, without the photo', async () => {
    const u = await newUser();
    await paid('ID_OK', 500000, u, 'identity');
    const r = await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_OK', user_id: 'someone-else' } });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body).sort(), ['cached', 'name', 'verified', 'verified_at']);
    const row = (await state()).tables.verifications.find((v) => v.user_id === u.id);
    assert.ok(row, 'record stored under the authenticated user, not the user_id in the body');
    assert.ok(!JSON.stringify(row.profile_data).includes('BASE64PHOTO'));
  });

  test('a second check for the same person is free (served from cache)', async () => {
    const u = await newUser();
    await paid('ID_CACHE', 500000, u, 'identity');
    await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_CACHE' } });
    const calls = (await state()).upstreamCalls.length;
    const again = await call('/api/verify-nin', { token: u.token, json: good });
    assert.equal(again.status, 200);
    assert.equal(again.body.cached, true);
    assert.equal((await state()).upstreamCalls.length, calls, 'no provider call, no charge');
  });

  test('the cache does not vouch for a different name', async () => {
    const u = await newUser();
    await paid('ID_CACHE2', 500000, u, 'identity');
    await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_CACHE2' } });
    const r = await call('/api/verify-nin', { token: u.token, json: { ...good, firstname: 'Totally', lastname: 'Different' } });
    assert.equal(r.status, 402, 'falls through to a fresh, paid check instead of returning EXACT_MATCH');
  });

  test('one payment cannot verify two people', { skip: SCHEMA === 'v1' && 'needs the payments ledger (migration 0005)' }, async () => {
    const u = await newUser();
    await paid('ID_ONCE', 500000, u, 'identity');
    assert.equal((await call('/api/verify-nin', { token: u.token, json: { ...good, payment_reference: 'ID_ONCE' } })).status, 200);
    const second = await call('/api/verify-nin', { token: u.token, json: { nin: '22000000001', firstname: 'Tunde', lastname: 'Bello', payment_reference: 'ID_ONCE' } });
    assert.equal(second.status, 402);
    assert.equal(second.body.code, 'PAYMENT_ALREADY_USED');
  });

  test('a NIN already linked to another account is refused before any payment or provider call', async () => {
    const first = await newUser();
    const second = await newUser();
    await paid('ID_FIRST', 500000, first, 'identity');
    assert.equal((await call('/api/verify-nin', { token: first.token, json: { ...good, payment_reference: 'ID_FIRST' } })).status, 200);
    const calls = (await state()).upstreamCalls.length;
    const r = await call('/api/verify-nin', { token: second.token, json: good }); // pre-check, no payment yet
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'NIN_IN_USE');
    assert.equal((await state()).upstreamCalls.length, calls);
  });

  test('unknown NIN gives a clear message', async () => {
    const u = await newUser();
    await paid('ID_UNKNOWN', 500000, u, 'identity');
    const r = await call('/api/verify-nin', { token: u.token, json: { ...good, nin: '99999999999', payment_reference: 'ID_UNKNOWN' } });
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'NIN_NOT_FOUND');
  });

  test('invalid JSON → 400', async () => {
    const u = await newUser();
    assert.equal((await call('/api/verify-nin', { token: u.token, json: '{nope' })).status, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/generate-qore-session', () => {
  test('signed-in user gets a session token', async () => {
    const u = await newUser();
    const r = await call('/api/generate-qore-session', { token: u.token });
    assert.equal(r.status, 200);
    assert.match(r.body.sdkSessionToken, /^sdk_/);
  });
  test('GET is not allowed', async () => {
    assert.equal((await call('/api/generate-qore-session', { method: 'GET' })).status, 405);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/submit-documents', () => {
  async function verifiedUser() {
    const u = await newUser();
    await admin('/row', { table: 'verifications', row: { id: crypto.randomUUID(), user_id: u.id, nin: String(10000000000 + ++n), profile_data: { applicant: { firstname: 'A', lastname: 'B' } }, created_at: new Date().toISOString() } });
    return u;
  }
  const fields = (ref) => ({ deceased_name: 'Samuel Adekunle Bello', date_of_death: '2025-01-10', relationship: 'Child', paystack_reference: ref });

  test('validates the form before anything else', async () => {
    const u = await verifiedUser();
    assert.equal((await call('/api/submit-documents', { token: u.token, json: {} })).status, 400);
    assert.equal((await call('/api/submit-documents', { token: u.token, form: docForm(fields('x'), {}) })).body.code, 'FILE_REQUIRED');
    assert.equal((await call('/api/submit-documents', { token: u.token, form: docForm({ ...fields('x'), deceased_name: '' }) })).body.code, 'NAME_REQUIRED');
    assert.equal((await call('/api/submit-documents', { token: u.token, form: docForm({ ...fields('x'), date_of_death: '2999-01-01' }) })).body.code, 'INVALID_DATE');
  });

  test('rejects executables and oversized files', async () => {
    const u = await verifiedUser();
    const exe = await call('/api/submit-documents', { token: u.token, form: docForm(fields('x'), { death_certificate: { blob: new Blob(['MZ'], { type: 'application/x-msdownload' }), name: 'evil.exe' } }) });
    assert.equal(exe.status, 415);
    const disguised = await call('/api/submit-documents', { token: u.token, form: docForm(fields('x'), { death_certificate: { blob: new Blob(['MZ'], { type: 'application/pdf' }), name: 'evil.exe' } }) });
    assert.equal(disguised.status, 415);
    const big = await call('/api/submit-documents', { token: u.token, form: docForm(fields('x'), { death_certificate: { blob: new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'application/pdf' }), name: 'big.pdf' } }) });
    assert.equal(big.status, 413);
    assert.equal((await state()).objects.length, 0, 'nothing was stored');
  });

  test('requires identity to be confirmed first', async () => {
    const u = await newUser();
    await paid('DOC_NOID', 7500000, u, 'submission');
    const r = await call('/api/submit-documents', { token: u.token, form: docForm(fields('DOC_NOID')) });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'IDENTITY_REQUIRED');
  });

  test('a made-up or too-small payment stores nothing and opens no case', async () => {
    const u = await verifiedUser();
    await paid('DOC_SMALL', 500000, u, 'submission');
    const objects = (await state()).objects.length;
    const cases = (await state()).tables.estates.length;
    assert.equal((await call('/api/submit-documents', { token: u.token, form: docForm(fields('FAKE_NEVER_PAID')) })).status, 402);
    assert.equal((await call('/api/submit-documents', { token: u.token, form: docForm(fields('DOC_SMALL')) })).body.code, 'PAYMENT_AMOUNT_MISMATCH');
    const s = await state();
    assert.equal(s.objects.length, objects);
    assert.equal(s.tables.estates.length, cases);
  });

  test('the identity payment cannot be reused as the filing payment', async () => {
    const u = await verifiedUser();
    await paid('ID_REUSE', 7500000, u, 'identity');
    assert.equal((await call('/api/submit-documents', { token: u.token, form: docForm(fields('ID_REUSE')) })).body.code, 'PAYMENT_PURPOSE_MISMATCH');
  });

  test('a paid submission opens a paid case in review — with OCR not configured', async () => {
    const u = await verifiedUser();
    await paid('DOC_OK', 7500000, u, 'submission');
    const r = await call('/api/submit-documents', {
      token: u.token,
      form: docForm({ ...fields('DOC_OK'), user_id: 'someone-else' }, {
        death_certificate: { blob: pdfFile(), name: 'death-certificate.pdf' },
        letter_of_administration: { blob: new Blob(['\x89PNG'], { type: 'image/png' }), name: 'loa.png' },
      }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const row = await estateRow(r.body.estateId);
    assert.equal(row.user_id, u.id, 'owner comes from the token, not the form');
    assert.equal(row.status, 'pending_review');
    assert.equal(row.payment_status, 'paid');
    assert.equal(row.estate_name, 'Estate of Samuel Adekunle Bello');
    assert.ok(row.letter_of_administration_path.endsWith('.png'));
    const keys = (await state()).objects.map((o) => o.key).filter((k) => k.includes(u.id));
    assert.equal(keys.length, 2);
  });

  test('retrying with the same payment returns the same case (no duplicate, no second charge)', async () => {
    const u = await verifiedUser();
    await paid('DOC_RETRY', 7500000, u, 'submission');
    const first = await call('/api/submit-documents', { token: u.token, form: docForm(fields('DOC_RETRY')) });
    const again = await call('/api/submit-documents', { token: u.token, form: docForm(fields('DOC_RETRY')) });
    assert.equal(again.status, 200);
    assert.equal(again.body.estateId, first.body.estateId);
    assert.equal(again.body.alreadySubmitted, true);
    assert.equal((await state()).tables.estates.filter((e) => e.paystack_reference === 'DOC_RETRY').length, 1);
  });

  test('another account cannot ride on a payment that already opened a case', async () => {
    const u = await verifiedUser();
    const thief = await verifiedUser();
    await admin('/tx', { reference: 'DOC_SHARED', status: 'success', amount: 7500000, currency: 'NGN', email: u.email, metadata: {} });
    await call('/api/submit-documents', { token: u.token, form: docForm(fields('DOC_SHARED')) });
    const r = await call('/api/submit-documents', { token: thief.token, form: docForm(fields('DOC_SHARED')) });
    assert.equal(r.status, 402);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/update-milestone', () => {
  test('owner of an approved case can record the bank letter', async () => {
    const { user, estateId } = await userWithEstate({ mandate_acknowledged: false });
    const r = await call('/api/update-milestone', { token: user.token, json: { estateId, mandateAcknowledged: true } });
    assert.equal(r.status, 200);
    assert.equal((await estateRow(estateId)).mandate_acknowledged, true);
  });
  test('a different signed-in user cannot touch the case', async () => {
    const { estateId } = await userWithEstate({ mandate_acknowledged: false });
    const stranger = await newUser();
    const r = await call('/api/update-milestone', { token: stranger.token, json: { estateId, mandateAcknowledged: true } });
    assert.equal(r.status, 404);
    assert.equal((await estateRow(estateId)).mandate_acknowledged, false);
  });
  test('not possible while the case is still in review', async () => {
    const { user, estateId } = await userWithEstate({ status: 'pending_review', mandate_acknowledged: false });
    const r = await call('/api/update-milestone', { token: user.token, json: { estateId, mandateAcknowledged: true } });
    assert.equal(r.status, 409);
    assert.equal((await estateRow(estateId)).mandate_acknowledged, false);
  });
  test('bad input → 400, unknown case → 404', async () => {
    const u = await newUser();
    assert.equal((await call('/api/update-milestone', { token: u.token, json: {} })).status, 400);
    assert.equal((await call('/api/update-milestone', { token: u.token, json: { estateId: 'nope', mandateAcknowledged: true } })).status, 400);
    assert.equal((await call('/api/update-milestone', { token: u.token, json: { estateId: crypto.randomUUID(), mandateAcknowledged: true } })).status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('BVN discovery (Mono v3): start → choose where the code goes → code → accounts', () => {
  const start = (user, estateId, bvn = '12345678901', headers = {}) => call('/api/igree/request-otp', { token: user.token, json: { bvn, estate_id: estateId }, headers });
  const send = (user, estateId, sessionId, method, phone_number) => call('/api/igree/request-otp', { token: user.token, json: { estate_id: estateId, sessionId, method, ...(phone_number ? { phone_number } : {}) } });
  const finish = (user, estateId, sessionId, otp) => call('/api/igree/verify-otp', { token: user.token, json: { sessionId, otp, estate_id: estateId } });

  test('full happy path with Mono\'s sandbox BVN, sending the code to the BVN phone', async () => {
    const { user, estateId } = await userWithEstate({ mandate_acknowledged: false });
    const s1 = await start(user, estateId);
    assert.equal(s1.status, 200, JSON.stringify(s1.body));
    assert.ok(s1.body.sessionId, 'session id is read from Mono\'s nested data object');
    assert.deepEqual(s1.body.channels.map((c) => c.method), ['email', 'phone', 'alternate_phone']);
    assert.equal(s1.body.channels[1].label, 'Text message to 0803***5678', 'the hint tells the family which phone it is');
    assert.equal(s1.body.channels[0].label, 'Email to sam***lo@gmail.com');
    assert.equal(s1.body.channels[2].needsPhone, true);
    assert.equal((await state()).upstreamCalls.filter((c) => c.path.endsWith('/verify')).length, 0, 'no code is sent until a channel is chosen');

    const s2 = await send(user, estateId, s1.body.sessionId, 'phone');
    assert.equal(s2.status, 200);
    assert.match(s2.body.sentTo, /0803\*\*\*5678/);

    const wrong = await finish(user, estateId, s1.body.sessionId, '000000');
    assert.equal(wrong.status, 422);
    assert.equal(wrong.body.code, 'OTP_REJECTED');

    const ok = await finish(user, estateId, s1.body.sessionId, '123456');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.accounts.length, 3);
    assert.equal(ok.body.newlyFound, 3);
    assert.deepEqual(ok.body.accounts[0], { bank_name: 'GTBank', bank_code: '058', nip_code: '000013', account_number: '0123456789', account_name: 'SAMUEL ADEKUNLE BELLO', account_type: 'SAVINGS' });
    const row = await estateRow(estateId);
    assert.equal(row.discovered_accounts.length, 3);
    assert.equal(row.status, 'verified', 'compliance status is untouched');
  });

  test('the code can go to another phone number (Mono "alternate_phone")', async () => {
    const { user, estateId } = await userWithEstate();
    const s1 = await start(user, estateId);
    assert.equal((await send(user, estateId, s1.body.sessionId, 'alternate_phone')).body.code, 'INVALID_PHONE');
    assert.equal((await send(user, estateId, s1.body.sessionId, 'alternate_phone', '12345')).body.code, 'INVALID_PHONE');
    const ok = await send(user, estateId, s1.body.sessionId, 'alternate_phone', '0906 666 2020');
    assert.equal(ok.status, 200);
    assert.match(ok.body.sentTo, /09066662020/);
    assert.equal((await finish(user, estateId, s1.body.sessionId, '123456')).status, 200);
  });

  test('searching again keeps the accounts already found', async () => {
    const { user, estateId } = await userWithEstate({ discovered_accounts: [{ bank_name: 'Wema Bank', bank_code: '035', account_number: '9998887776', account_name: 'S BELLO', account_type: 'SAVINGS' }] });
    const s1 = await start(user, estateId);
    await send(user, estateId, s1.body.sessionId, 'email');
    const ok = await finish(user, estateId, s1.body.sessionId, '123456');
    assert.equal(ok.body.accounts.length, 4);
    assert.equal(ok.body.newlyFound, 3);
  });

  test('an expired or unknown session is reported clearly', async () => {
    const { user, estateId } = await userWithEstate();
    const r = await send(user, estateId, 'not-a-real-session', 'phone');
    assert.equal(r.status, 410);
    assert.equal(r.body.code, 'SESSION_EXPIRED');
    assert.equal((await finish(user, estateId, 'not-a-real-session', '123456')).body.code, 'SESSION_EXPIRED');
  });

  test('the BVN is never written to the log in full', async () => {
    const logs = (await state()).tables.bvn_request_logs;
    assert.ok(logs.length > 0);
    for (const l of logs) assert.ok(!/^\d{11}$/.test(l.bvn ?? ''), `raw BVN logged: ${l.bvn}`);
  });

  test('cannot be run on a case that is still in review (no skipping compliance)', async () => {
    const { user, estateId } = await userWithEstate({ status: 'pending_review' });
    assert.equal((await start(user, estateId)).status, 409);
    assert.equal((await finish(user, estateId, 'x', '123456')).status, 409);
    assert.equal((await estateRow(estateId)).status, 'pending_review');
  });

  test('cannot be run against somebody else\'s case', async () => {
    const { estateId } = await userWithEstate();
    const stranger = await newUser();
    assert.equal((await start(stranger, estateId)).status, 404);
    assert.equal((await finish(stranger, estateId, 'x', '123456')).status, 404);
  });

  test('bad and unknown BVNs, and an unknown channel', async () => {
    const { user, estateId } = await userWithEstate();
    assert.equal((await start(user, estateId, '123')).status, 400);
    const unknown = await start(user, estateId, '99999999999');
    assert.equal(unknown.status, 422);
    assert.equal(unknown.body.code, 'BVN_LOOKUP_FAILED');
    const s1 = await start(user, estateId);
    assert.equal((await send(user, estateId, s1.body.sessionId, 'carrier pigeon')).body.code, 'INVALID_METHOD');
  });

  test('limited to 5 searches an hour per account — changing X-Forwarded-For does not help', async () => {
    const { user, estateId } = await userWithEstate();
    for (const ip of ['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4', '10.0.0.5']) assert.equal((await start(user, estateId, '12345678901', { 'x-forwarded-for': ip })).status, 200);
    assert.equal((await start(user, estateId, '12345678901', { 'x-forwarded-for': '10.0.0.6' })).status, 429);
  });

  test('a BVN with no accounts is a successful, empty result', async () => {
    const { user, estateId } = await userWithEstate();
    const s1 = await start(user, estateId, '22345678901');
    await send(user, estateId, s1.body.sessionId, 'phone');
    const ok = await finish(user, estateId, s1.body.sessionId, '123456');
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.accounts, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/verify-estate-nuban (payout gate)', () => {
  let ctx;
  before(async () => {
    ctx = await userWithEstate();
  });
  const check = (accountNumber, bankCode) => call('/api/verify-estate-nuban', { token: ctx.user.token, json: { estate_id: ctx.estateId, accountNumber, bankCode } });

  test('an estate account in the deceased\'s name passes', async () => {
    const r = await check('0123456789', '058');
    assert.equal(r.status, 200);
    assert.equal(r.body.verified, true);
  });
  test('a relative who only shares the surname is blocked', async () => {
    const r = await check('2222222222', '044');
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'NUBAN_NAME_MISMATCH');
  });
  test('a company with "Estate" in its name is blocked', async () => {
    assert.equal((await check('4444444444', '011')).status, 422);
  });
  test('the deceased\'s own personal account is blocked (not an estate account)', async () => {
    const r = await check('1111111111', '058');
    assert.equal(r.status, 422);
    assert.equal(r.body.code, 'NOT_AN_ESTATE_ACCOUNT');
  });
  test('an unrelated person is blocked; an unknown account is reported clearly', async () => {
    assert.equal((await check('3333333333', '044')).status, 422);
    assert.equal((await check('0000000000', '058')).body.code, 'ACCOUNT_NOT_RESOLVED');
  });
  test('the expected name cannot be supplied by the caller', async () => {
    const r = await call('/api/verify-estate-nuban', { token: ctx.user.token, json: { estate_id: ctx.estateId, accountNumber: '3333333333', bankCode: '044', expectedDeceasedName: 'Chidi Okafor' } });
    assert.equal(r.status, 422);
  });
  test('input validation', async () => {
    assert.equal((await check('012345678', '058')).status, 400);
    assert.equal((await check('0123456789', '')).status, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/generate-inventory', () => {
  const accounts = (count) => Array.from({ length: count }, (_, i) => ({ bank_name: `Bank ${i + 1}`, bank_code: '058', account_number: String(1000000000 + i), account_name: 'SAMUEL BELLO', account_type: 'SAVINGS' }));

  test('produces a real PDF for the owner (the ₦ crash is gone)', async () => {
    const { user, estateId } = await userWithEstate({ discovered_accounts: accounts(3) });
    const r = await call('/api/generate-inventory', { token: user.token, json: { estate_id: estateId } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/pdf');
    assert.equal(r.body.subarray(0, 5).toString(), '%PDF-');
    assert.match(r.headers.get('content-disposition'), /Schedule_of_Assets_REQ-/);
  });
  test('60 accounts flow onto more pages instead of being cut off', async () => {
    const { user, estateId } = await userWithEstate({ discovered_accounts: accounts(60) });
    const r = await call('/api/generate-inventory', { token: user.token, json: { estate_id: estateId } });
    assert.equal(r.status, 200);
    const pages = (await PDFDocument.load(r.body)).getPageCount();
    assert.ok(pages >= 3, `expected 3+ pages, got ${pages}`);
  });
  test('the caller cannot inject names or assets', async () => {
    const { user, estateId } = await userWithEstate({ discovered_accounts: accounts(1) });
    const r = await call('/api/generate-inventory', { token: user.token, json: { estate_id: estateId, deceasedName: 'Anyone', administratorName: 'Forged', assets: [{ description: 'x', institution: 'y', value: 999999999 }] } });
    assert.equal(r.status, 200);
    const doc = await PDFDocument.load(r.body);
    assert.equal(doc.getPageCount(), 1);
    assert.equal(doc.getTitle(), 'Schedule of Assets - Estate of Samuel Adekunle Bello', 'built from the case on file, not from the request');
  });
  test('no accounts yet → 409; someone else\'s case → 404; GET → 405', async () => {
    const empty = await userWithEstate();
    assert.equal((await call('/api/generate-inventory', { token: empty.user.token, json: { estate_id: empty.estateId } })).status, 409);
    const stranger = await newUser();
    assert.equal((await call('/api/generate-inventory', { token: stranger.token, json: { estate_id: empty.estateId } })).status, 404);
    assert.equal((await call('/api/generate-inventory', { method: 'GET' })).status, 405);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/webhook/paystack', () => {
  const sign = (body) => crypto.createHmac('sha512', 'sk_test_mock').update(body).digest('hex');
  const send = (payload, signature) => {
    const body = JSON.stringify(payload);
    return call('/api/webhook/paystack', { json: body, headers: signature === null ? {} : { 'x-paystack-signature': signature ?? sign(body) } });
  };

  test('rejects missing and wrong signatures', async () => {
    assert.equal((await send({ event: 'charge.success' }, null)).status, 401);
    assert.equal((await send({ event: 'charge.success' }, 'deadbeef')).status, 401);
    assert.equal((await send({ event: 'charge.success' }, 'a'.repeat(128))).status, 401);
  });
  test('marks exactly the case that the payment reference belongs to', async () => {
    const a = await userWithEstate({ payment_status: 'unpaid', paystack_reference: 'WH_A' });
    const b = await userWithEstate({ payment_status: 'unpaid', paystack_reference: 'WH_B' });
    const r = await send({ event: 'charge.success', data: { reference: 'WH_A', amount: 7500000, currency: 'NGN', metadata: {} } });
    assert.equal(r.status, 200);
    assert.equal((await estateRow(a.estateId)).payment_status, 'paid');
    assert.equal((await estateRow(b.estateId)).payment_status, 'unpaid');
  });
  test('a ₦1 charge with forged metadata unlocks nothing', async () => {
    const a = await userWithEstate({ payment_status: 'unpaid', paystack_reference: 'WH_C' });
    await send({ event: 'charge.success', data: { reference: 'WH_C', amount: 100, currency: 'NGN', metadata: { user_id: a.user.id, estate_id: a.estateId } } });
    await send({ event: 'charge.success', data: { reference: 'SOMETHING_ELSE', amount: 7500000, currency: 'NGN', metadata: { user_id: a.user.id, estate_id: a.estateId } } });
    assert.equal((await estateRow(a.estateId)).payment_status, 'unpaid');
  });
  test('other events are acknowledged and ignored', async () => {
    assert.equal((await send({ event: 'transfer.success', data: {} })).status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('legacy links keep working', () => {
  const hop = async (path) => {
    const res = await fetch(APP + path, { redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location') };
  };
  for (const [from, to] of [
    ['/index.html', '/'],
    ['/auth.html', '/login'],
    ['/auth.html?tab=signup', '/signup'],
    ['/dashboard.html', '/app'],
    ['/discovery-wizard.html', '/app/new'],
    ['/vault.html', '/app/vault'],
    ['/recovery-detail.html?id=9d2dd87b-d49e-4ac5-a8ac-7e9e09b4ea2b', '/app/estates/9d2dd87b-d49e-4ac5-a8ac-7e9e09b4ea2b'],
    ['/bvn-discovery.html?estate_id=9d2dd87b-d49e-4ac5-a8ac-7e9e09b4ea2b', '/app/estates/9d2dd87b-d49e-4ac5-a8ac-7e9e09b4ea2b'],
    ['/privacy.html', '/privacy'],
    ['/terms.html', '/terms'],
  ]) {
    test(`${from} → ${to}`, async () => {
      const r = await hop(from);
      assert.ok([307, 308].includes(r.status), `status ${r.status}`);
      assert.equal(new URL(r.location, APP).pathname, to);
    });
  }
  test('the site root answers 200', async () => {
    assert.equal((await fetch(APP + '/')).status, 200);
  });
});
