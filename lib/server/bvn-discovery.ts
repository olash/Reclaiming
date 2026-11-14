import { HttpError } from './http';
import { mono, normaliseAccount, type DiscoveredAccount } from './mono';

/**
 * One interface for "find every bank account linked to a BVN, with the
 * BVN holder's consent (NIBSS iGree)". Mono implements it today; another
 * provider (see docs/MONO_ALTERNATIVES.md) can be added behind the same
 * three calls and selected with BVN_PROVIDER, without touching the UI.
 */
export interface CodeChannel {
  /** Provider's id for the channel, e.g. "phone", "phone_1", "email", "alternate_phone". */
  method: string;
  /** Plain-language description for the family, e.g. "SMS to 0818***6496". */
  label: string;
  /** True when the family must type the phone number the code should go to. */
  needsPhone: boolean;
}

export interface BvnDiscoveryProvider {
  name: string;
  start(bvn: string): Promise<{ sessionId: string; channels: CodeChannel[] }>;
  sendCode(sessionId: string, method: string, phoneNumber?: string): Promise<{ sentTo: string }>;
  fetchAccounts(sessionId: string, otp: string): Promise<DiscoveredAccount[]>;
}

const providerError = (status: number) => (status === 400 || status === 404 || status === 422 ? 422 : 502);
const message = (data: any, fallback: string) => (typeof data?.message === 'string' && data.message.length < 200 ? data.message : fallback);

/** Short, plain labels: "Text message to 0818***6496", "Email to tomi***jr@gmail.com". */
export function channelLabel(m: { method?: string; hint?: string }): string {
  const target = m.hint?.match(/\bto (?:phone )?([^\s]*[*@][^\s]*)\s*$/i)?.[1]?.replace(/[.,]$/, '');
  switch (m.method) {
    case 'email':
      return target ? `Email to ${target}` : 'Email to the address on the BVN';
    case 'phone':
      return target ? `Text message to ${target}` : 'Text message to the main phone on the BVN';
    case 'phone_1':
      return target ? `Text message to ${target}` : 'Text message to the second phone on the BVN';
    case 'alternate_phone':
      return 'Text message to another phone number';
    default:
      return m.hint || String(m.method);
  }
}

export const monoProvider: BvnDiscoveryProvider = {
  name: 'mono',
  async start(bvn) {
    const r = await mono('initiate', { bvn, scope: 'bank_accounts' });
    const sessionId: string | undefined = r.data?.data?.session_id ?? r.data?.session_id;
    if (!r.ok || !sessionId) {
      console.warn('[bvn-discovery:mono] initiate failed', r.status, r.data?.message);
      throw new HttpError(providerError(r.status), 'We could not start a search for that BVN. Please check the number and try again.', 'BVN_LOOKUP_FAILED');
    }
    const raw: any[] = Array.isArray(r.data?.data?.methods) ? r.data.data.methods : [];
    const channels = raw
      .map((m) => (typeof m === 'string' ? { method: m } : m))
      .filter((m) => m && typeof m.method === 'string')
      .map((m) => ({ method: m.method, label: channelLabel(m), needsPhone: m.method === 'alternate_phone' }));
    return { sessionId, channels: channels.length ? channels : [{ method: 'phone', label: channelLabel({ method: 'phone' }), needsPhone: false }] };
  },
  async sendCode(sessionId, method, phoneNumber) {
    const r = await mono('verify', { method, ...(phoneNumber ? { phone_number: phoneNumber } : {}) }, sessionId);
    if (!r.ok) {
      console.warn('[bvn-discovery:mono] verify failed', r.status, r.data?.message);
      if (r.status === 400 && /session/i.test(r.data?.message ?? '')) {
        throw new HttpError(410, 'This search has expired (they last 10 minutes). Please start again.', 'SESSION_EXPIRED');
      }
      throw new HttpError(providerError(r.status), message(r.data, 'We could not send the code. Please try another option or try again shortly.'), 'OTP_SEND_FAILED');
    }
    return { sentTo: message(r.data, 'Code sent.') };
  },
  async fetchAccounts(sessionId, otp) {
    const r = await mono('details', { otp }, sessionId);
    if (!r.ok) {
      console.warn('[bvn-discovery:mono] details failed', r.status, r.data?.message);
      if (r.status === 400 && /session/i.test(r.data?.message ?? '')) {
        throw new HttpError(410, 'This search has expired (they last 10 minutes). Please start again.', 'SESSION_EXPIRED');
      }
      throw new HttpError(providerError(r.status), 'That code was not accepted. Check it and try again, or request a new code.', 'OTP_REJECTED');
    }
    const list: any[] = Array.isArray(r.data?.data) ? r.data.data : [];
    return list.map(normaliseAccount).filter((a) => a.account_number);
  },
};

export function bvnProvider(): BvnDiscoveryProvider {
  const name = (process.env.BVN_PROVIDER || 'mono').toLowerCase();
  switch (name) {
    case 'mono':
      return monoProvider;
    default:
      throw new HttpError(503, 'Account discovery is not configured.', 'NOT_CONFIGURED');
  }
}
