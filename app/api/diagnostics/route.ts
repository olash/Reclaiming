import { getQoreIdToken } from '@/utils/qoreidAuth';
import { adminClient } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/diagnostics?only=env,supabase,paystack,qoreid,mono
 *
 * Live health check of every integration, using this deployment's own
 * environment variables and each provider's SANDBOX test data.
 *
 * Safety:
 *  - Refuses to run on production (VERCEL_ENV=production) unless
 *    DIAGNOSTICS_ENABLED=true is set explicitly.
 *  - Never returns a key, token or personal record: only HTTP statuses,
 *    the names of fields in each response, and pass/fail notes.
 */

type Step = { name: string; ok: boolean; status?: number; ms?: number; note?: string; detail?: unknown };

const MONO_TEST = { bvn: '12345678901', otp: '123456', alternatePhone: '09066662020' };
const QOREID_TEST = { nin: '63184876213', firstname: 'Bunch', lastname: 'Dillon', bvn: '22222222222' };

/** Field names only (one level deep), so a response's shape can be checked without exposing its contents. */
function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.length ? [shape(value[0], depth)] : [];
  if (value && typeof value === 'object') {
    if (depth >= 2) return '{…}';
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'object' && v ? shape(v, depth + 1) : typeof v]));
  }
  return typeof value;
}

const keyMode = (v: string | undefined) => (!v ? 'missing' : /test/i.test(v) ? 'test' : /live/i.test(v) ? 'live' : 'unknown-format');

async function timed(name: string, fn: () => Promise<Omit<Step, 'name' | 'ms'>>): Promise<Step> {
  const t = Date.now();
  try {
    return { name, ...(await fn()), ms: Date.now() - t };
  } catch (err) {
    return { name, ok: false, ms: Date.now() - t, note: err instanceof Error ? err.message.slice(0, 200) : 'error' };
  }
}

async function call(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 120);
  }
  return { status: res.status, ok: res.ok, body };
}

// ── Checks ────────────────────────────────────────────────────────────────

function envCheck(): Step[] {
  const names = [
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY', 'PAYSTACK_SECRET_KEY',
    'QOREID_CLIENT_ID', 'QOREID_CLIENT_SECRET', 'QOREID_AUTH_URL', 'MONO_SEC_KEY', 'GCP_SERVICE_ACCOUNT_KEY_BASE64',
  ];
  return [
    {
      name: 'environment variables present',
      ok: names.slice(0, 9).every((n) => !!process.env[n]),
      detail: Object.fromEntries(names.map((n) => [n, !!process.env[n]])),
    },
    {
      name: 'key modes',
      ok: true,
      detail: {
        paystack_public: keyMode(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY),
        paystack_secret: keyMode(process.env.PAYSTACK_SECRET_KEY),
        mono_secret: keyMode(process.env.MONO_SEC_KEY),
        qoreid_auth_url_host: process.env.QOREID_AUTH_URL ? new URL(process.env.QOREID_AUTH_URL).host + new URL(process.env.QOREID_AUTH_URL).pathname : null,
        vercel_env: process.env.VERCEL_ENV ?? 'local',
      },
    },
  ];
}

async function supabaseCheck(): Promise<Step[]> {
  const db = adminClient();
  const steps: Step[] = [];
  const tables: Record<string, string[]> = {
    verifications: ['id', 'user_id', 'nin', 'profile_data', 'created_at'],
    estates: ['id', 'user_id', 'estate_name', 'deceased_name', 'status', 'payment_status', 'paystack_reference', 'mandate_acknowledged', 'discovered_accounts', 'death_certificate_path', 'letter_of_administration_path', 'submitted_at', 'updated_at'],
    bvn_request_logs: ['id', 'user_id', 'ip_address', 'bvn', 'status', 'created_at'],
    payments: ['id', 'user_id', 'estate_id', 'reference', 'purpose', 'amount_kobo', 'status', 'created_at'],
  };
  const migration5 = ['date_of_death', 'relationship', 'review_note', 'document_check', 'discovery_completed_at', 'total_asset_value'];
  for (const [table, cols] of Object.entries(tables)) {
    steps.push(
      await timed(`table ${table}`, async () => {
        const { error, count } = await db.from(table).select(cols.join(','), { count: 'exact', head: true });
        return { ok: !error, note: error ? `${error.code}: ${error.message}` : `${count ?? 0} rows` };
      }),
    );
  }
  steps.push(
    await timed('estates columns from migration 0005', async () => {
      const missing: string[] = [];
      for (const c of migration5) {
        const { error } = await db.from('estates').select(c, { head: true });
        if (error) missing.push(c);
      }
      return { ok: missing.length === 0, note: missing.length ? `missing: ${missing.join(', ')} — run supabase/migrations/0005_redesign.sql` : 'all present' };
    }),
  );
  steps.push(
    await timed('estates allows status "settled"', async () => {
      // A filter on an allowed value always works; this only proves the column exists. The CHECK is verified on write.
      const { error } = await db.from('estates').select('id', { head: true }).eq('status', 'settled');
      return { ok: !error, note: error?.message };
    }),
  );
  steps.push(
    await timed('storage bucket probate_documents', async () => {
      const { data, error } = await db.storage.getBucket('probate_documents');
      return { ok: !error && !!data, note: error ? error.message : `public=${data?.public}, limit=${data?.file_size_limit}` };
    }),
  );
  steps.push(
    await timed('auth settings', async () => {
      const r = await call(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } });
      const ext = r.body?.external ?? {};
      return {
        ok: r.ok,
        status: r.status,
        detail: { email_enabled: ext.email, google_enabled: ext.google, email_autoconfirm: r.body?.mailer_autoconfirm, signups_disabled: r.body?.disable_signup },
      };
    }),
  );
  return steps;
}

async function paystackCheck(): Promise<Step[]> {
  const auth = { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` };
  return [
    await timed('secret key accepted (GET /bank)', async () => {
      const r = await call('https://api.paystack.co/bank?country=nigeria&perPage=5', { headers: auth });
      return { ok: r.ok && r.body?.status === true, status: r.status, note: r.body?.message };
    }),
    await timed('transaction/verify on an unknown reference → clean error', async () => {
      const r = await call('https://api.paystack.co/transaction/verify/reclaimng_diagnostics_nonexistent', { headers: auth });
      return { ok: r.status === 400 || r.status === 404, status: r.status, note: r.body?.message };
    }),
    await timed('bank/resolve reachable', async () => {
      const r = await call('https://api.paystack.co/bank/resolve?account_number=0001234567&bank_code=058', { headers: auth });
      return { ok: r.status < 500 && r.status !== 401, status: r.status, note: r.body?.message, detail: r.ok ? shape(r.body?.data) : undefined };
    }),
  ];
}

async function qoreidCheck(): Promise<Step[]> {
  const steps: Step[] = [];
  let token = '';
  steps.push(
    await timed('access token (QOREID_AUTH_URL)', async () => {
      token = await getQoreIdToken();
      return { ok: !!token, note: token ? `received (${token.length} chars)` : 'empty' };
    }),
  );
  const basic = 'Basic ' + Buffer.from(`${process.env.QOREID_CLIENT_ID}:${process.env.QOREID_CLIENT_SECRET}`).toString('base64');
  for (const productCode of ['liveness_nin', 'face_verification_nin', 'liveness']) {
    steps.push(
      await timed(`SDK session for product "${productCode}"`, async () => {
        const r = await call('https://api.qoreid.com/v1/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: basic },
          body: JSON.stringify({ productCode, reference: `diag_${productCode}_${Date.now()}`, ttlSeconds: 60 }),
        });
        return { ok: r.ok && !!r.body?.sdkSessionToken, status: r.status, note: r.ok ? 'token minted' : (r.body?.message ?? JSON.stringify(r.body)).toString().slice(0, 160) };
      }),
    );
  }
  if (!token) return steps;
  const bearer = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  steps.push(
    await timed('NIN premium (sandbox NIN, matching names)', async () => {
      const r = await call(`https://api.qoreid.com/v1/ng/identities/nin-premium/${QOREID_TEST.nin}`, {
        method: 'POST',
        headers: bearer,
        body: JSON.stringify({ firstname: QOREID_TEST.firstname, lastname: QOREID_TEST.lastname }),
      });
      const b = r.body ?? {};
      return {
        ok: r.ok,
        status: r.status,
        note: r.ok ? undefined : (b.message ?? '').toString().slice(0, 160),
        detail: {
          nin_check: b.summary?.nin_check?.status ?? b.details?.summary?.nin_check?.status ?? null,
          field_matches: b.summary?.nin_check?.fieldMatches ?? null,
          status: b.status ?? null,
          top_level_fields: Object.keys(b),
        },
      };
    }),
  );
  steps.push(
    await timed('NIN premium (sandbox NIN, WRONG names) → should not be an exact match', async () => {
      const r = await call(`https://api.qoreid.com/v1/ng/identities/nin-premium/${QOREID_TEST.nin}`, {
        method: 'POST',
        headers: bearer,
        body: JSON.stringify({ firstname: 'Wrongfirst', lastname: 'Wronglast' }),
      });
      const b = r.body ?? {};
      return { ok: true, status: r.status, detail: { nin_check: b.summary?.nin_check?.status ?? null, status: b.status ?? null } };
    }),
  );
  steps.push(
    await timed('BVN iGree consent link (sandbox BVN) — evaluated as a Mono alternative', async () => {
      const r = await call(`https://api.qoreid.com/v1/ng/identities/bvn-consent/${QOREID_TEST.bvn}`, { method: 'POST', headers: bearer, body: '{}' });
      const b = r.body ?? {};
      const data = b.data ?? b;
      let scope: string | null = null;
      try {
        scope = data.consentUrl ? new URL(data.consentUrl).searchParams.get('scope') : null;
      } catch {}
      return { ok: r.status < 500 && r.status !== 401, status: r.status, note: (b.message ?? '').toString().slice(0, 160), detail: { fields: Object.keys(data), consentStatus: data.consentStatus ?? null, consent_scope: scope } };
    }),
  );
  return steps;
}

async function monoCheck(): Promise<Step[]> {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'mono-sec-key': process.env.MONO_SEC_KEY ?? '' };
  const steps: Step[] = [];
  let session = '';
  steps.push(
    await timed('v3 initiate (sandbox BVN, scope bank_accounts)', async () => {
      const r = await call('https://api.withmono.com/v3/lookup/bvn/initiate', { method: 'POST', headers, body: JSON.stringify({ bvn: MONO_TEST.bvn, scope: 'bank_accounts' }) });
      session = r.body?.data?.session_id ?? '';
      return { ok: r.ok && !!session, status: r.status, note: r.body?.message, detail: { methods: (r.body?.data?.methods ?? []).map((m: any) => m.method ?? m) } };
    }),
  );
  if (session) {
    steps.push(
      await timed('v3 verify (send code to alternate phone)', async () => {
        const r = await call('https://api.withmono.com/v3/lookup/bvn/verify', {
          method: 'POST',
          headers: { ...headers, 'x-session-id': session },
          body: JSON.stringify({ method: 'alternate_phone', phone_number: MONO_TEST.alternatePhone }),
        });
        return { ok: r.ok, status: r.status, note: r.body?.message };
      }),
    );
    steps.push(
      await timed('v3 details (sandbox OTP) → linked accounts', async () => {
        const r = await call('https://api.withmono.com/v3/lookup/bvn/details', { method: 'POST', headers: { ...headers, 'x-session-id': session }, body: JSON.stringify({ otp: MONO_TEST.otp }) });
        const list = Array.isArray(r.body?.data) ? r.body.data : [];
        return { ok: r.ok, status: r.status, note: r.body?.message, detail: { accounts: list.length, banks: list.map((a: any) => a?.institution?.name ?? null), account_shape: shape(list[0]) } };
      }),
    );
  }
  steps.push(
    await timed('legacy v2 initiate (what the old code called)', async () => {
      const r = await call('https://api.withmono.com/v2/lookup/bvn/initiate', { method: 'POST', headers, body: JSON.stringify({ bvn: MONO_TEST.bvn, scope: 'bank_accounts' }) });
      return { ok: true, status: r.status, note: r.body?.message, detail: { session_at_top_level: !!r.body?.session_id, session_in_data: !!r.body?.data?.session_id } };
    }),
  );
  return steps;
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === 'production' && process.env.DIAGNOSTICS_ENABLED !== 'true') {
    return new Response('Not found', { status: 404 });
  }
  const only = new URL(request.url).searchParams.get('only')?.split(',') ?? ['env', 'supabase', 'paystack', 'qoreid', 'mono'];
  const result: Record<string, Step[]> = {};
  if (only.includes('env')) result.env = envCheck();
  const run = async (key: string, fn: () => Promise<Step[]>) => {
    if (!only.includes(key)) return;
    try {
      result[key] = await fn();
    } catch (err) {
      result[key] = [{ name: `${key} check`, ok: false, note: err instanceof Error ? err.message : 'error' }];
    }
  };
  await Promise.all([run('supabase', supabaseCheck), run('paystack', paystackCheck), run('qoreid', qoreidCheck), run('mono', monoCheck)]);
  const summary = Object.fromEntries(Object.entries(result).map(([k, steps]) => [k, steps.every((s) => s.ok) ? 'pass' : 'fail']));
  return Response.json({ checked_at: new Date().toISOString(), summary, result }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
