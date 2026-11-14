import { FEES, type FeePurpose } from '@/lib/fees';
import { HttpError } from './http';
import { adminClient, isMissingSchema } from './supabase';

interface PaystackVerify {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    customer?: { email?: string };
    metadata?: Record<string, unknown> | string | null;
  };
}

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    console.error('[paystack] PAYSTACK_SECRET_KEY is not set.');
    throw new HttpError(503, 'Payments are not available right now. Please contact support.', 'NOT_CONFIGURED');
  }
  return key;
}

export async function paystackGet<T>(path: string): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    headers: { Authorization: `Bearer ${secret()}`, 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}

/**
 * Confirms with Paystack — not with the browser — that a payment really
 * happened, for the right amount, by the person now presenting it.
 */
export async function assertPaid(opts: { reference: unknown; purpose: FeePurpose; userId: string; email?: string | null }) {
  const { purpose, userId, email } = opts;
  const reference = typeof opts.reference === 'string' ? opts.reference.trim() : '';
  if (!reference || reference.length > 100 || !/^[\w.=-]+$/.test(reference)) {
    throw new HttpError(402, 'We could not find your payment. Please complete payment to continue.', 'PAYMENT_REQUIRED');
  }

  const { ok, body } = await paystackGet<PaystackVerify>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const tx = body?.data;
  if (!ok || !body?.status || !tx) {
    throw new HttpError(402, 'We could not confirm that payment with Paystack. If you were charged, contact support with your reference.', 'PAYMENT_NOT_FOUND', { reference });
  }
  if (tx.status !== 'success') {
    throw new HttpError(402, 'That payment did not complete. Please try again.', 'PAYMENT_INCOMPLETE', { reference });
  }
  const expected = FEES[purpose].kobo;
  if (tx.currency !== 'NGN' || tx.amount < expected) {
    throw new HttpError(402, 'That payment does not match the fee for this step.', 'PAYMENT_AMOUNT_MISMATCH', { reference });
  }
  const meta = typeof tx.metadata === 'object' && tx.metadata ? tx.metadata : {};
  const metaUser = typeof meta.user_id === 'string' ? meta.user_id : null;
  const payer = tx.customer?.email?.toLowerCase();
  const belongsToCaller = metaUser ? metaUser === userId : !!payer && !!email && payer === email.toLowerCase();
  if (!belongsToCaller) {
    throw new HttpError(402, 'That payment belongs to a different account.', 'PAYMENT_OWNER_MISMATCH', { reference });
  }
  if (typeof meta.purpose === 'string' && meta.purpose !== purpose) {
    throw new HttpError(402, 'That payment was made for a different step.', 'PAYMENT_PURPOSE_MISMATCH', { reference });
  }
  return { reference, amount: tx.amount };
}

/**
 * Payment ledger (table `payments`, added by migration 0005). It stops one
 * payment being spent twice. If the table has not been created yet the app
 * still works — it simply relies on the Paystack check alone.
 */
export async function findLedgerEntry(reference: string) {
  const { data, error } = await adminClient().from('payments').select('*').eq('reference', reference).limit(1);
  if (error) {
    if (!isMissingSchema(error)) console.warn('[payments] ledger lookup failed:', error.message);
    return null;
  }
  return (data?.[0] as { user_id: string; purpose: string; status: string; estate_id: string | null } | undefined) ?? null;
}

export async function recordLedgerEntry(entry: { user_id: string; reference: string; purpose: FeePurpose; amount_kobo: number; estate_id?: string | null; status?: string }) {
  const { error } = await adminClient().from('payments').insert({ status: 'used', estate_id: null, ...entry });
  if (error && !isMissingSchema(error) && error.code !== '23505') console.warn('[payments] ledger write failed:', error.message);
}
