import { HttpError } from './http';

/**
 * Mono Lookup — BVN iGree (consent-based) API, v3.
 * Docs: https://docs.mono.co/docs/lookup/bvn-igree
 *
 *   POST /v3/lookup/bvn/initiate  { bvn, scope }            → data.session_id, data.methods[]
 *   POST /v3/lookup/bvn/verify    { method, phone_number? } (x-session-id) → code sent
 *   POST /v3/lookup/bvn/details   { otp }                   (x-session-id) → data[] accounts
 *
 * A session lasts 10 minutes. Every call is billable in live mode (sandbox is free),
 * including failed lookups, so callers must validate input first.
 */
const BASE = 'https://api.withmono.com/v3/lookup/bvn';

function key() {
  const k = process.env.MONO_SEC_KEY;
  if (!k) throw new HttpError(503, 'Account discovery is not available right now. Please contact support.', 'NOT_CONFIGURED');
  return k;
}

export async function mono(step: 'initiate' | 'verify' | 'details', body: unknown, sessionId?: string) {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${step}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'mono-sec-key': key(),
        ...(sessionId ? { 'x-session-id': sessionId } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new HttpError(502, 'We could not reach the account search service. Please try again in a minute.', 'PROVIDER_UNREACHABLE');
  }
  const data: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export interface DiscoveredAccount {
  bank_name: string;
  bank_code: string | null;
  nip_code?: string | null;
  account_number: string;
  account_name: string | null;
  account_type: string | null;
}

/** Mono returns `institution` as an object; older rows stored other shapes. One shape for the UI. */
export function normaliseAccount(raw: any): DiscoveredAccount {
  const inst = raw?.institution;
  const isObj = typeof inst === 'object' && inst;
  return {
    bank_name: (isObj ? inst.name : inst) || raw?.bank_name || raw?.bankName || raw?.bank || 'Unknown bank',
    bank_code: (isObj ? inst.bank_code : null) ?? raw?.bank_code ?? null,
    nip_code: (isObj ? inst.nip_code : null) ?? raw?.nip_code ?? null,
    account_number: String(raw?.account_number ?? raw?.accountNumber ?? ''),
    account_name: raw?.account_name ?? raw?.accountName ?? null,
    account_type: raw?.account_type ?? raw?.type ?? null,
  };
}
