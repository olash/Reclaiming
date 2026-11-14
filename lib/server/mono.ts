import { HttpError } from './http';

function key() {
  const k = process.env.MONO_SEC_KEY;
  if (!k) throw new HttpError(503, 'Account discovery is not available right now. Please contact support.', 'NOT_CONFIGURED');
  return k;
}

export async function mono(path: string, body: unknown, sessionId?: string) {
  const res = await fetch(`https://api.withmono.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'mono-sec-key': key(), ...(sessionId ? { 'x-session-id': sessionId } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export interface DiscoveredAccount {
  bank_name: string;
  bank_code: string | null;
  account_number: string;
  account_name: string | null;
  account_type: string | null;
}

/** Mono returns `institution` as an object; older rows stored other shapes. One shape for the UI. */
export function normaliseAccount(raw: any): DiscoveredAccount {
  const inst = raw?.institution;
  return {
    bank_name: (typeof inst === 'object' && inst ? inst.name : inst) || raw?.bank_name || raw?.bankName || raw?.bank || 'Unknown bank',
    bank_code: (typeof inst === 'object' && inst ? inst.bank_code : null) ?? raw?.bank_code ?? null,
    account_number: String(raw?.account_number ?? raw?.accountNumber ?? ''),
    account_name: raw?.account_name ?? raw?.accountName ?? null,
    account_type: raw?.account_type ?? raw?.type ?? null,
  };
}
