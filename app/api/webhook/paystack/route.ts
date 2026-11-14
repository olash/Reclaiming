import crypto from 'crypto';
import { FEES } from '@/lib/fees';
import { json } from '@/lib/server/http';
import { adminClient, isMissingSchema } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhook/paystack
 *
 * Paystack's server-to-server confirmation. It is the safety net for the case
 * where a family pays but closes the tab before their browser reports back:
 * the matching case is found by its payment reference and marked paid.
 *
 * It only ever marks the one case the payment was made for, and only when the
 * amount covers the fee.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error('[paystack-webhook] PAYSTACK_SECRET_KEY is not set.');
    return json({ error: 'Server configuration error' }, 503);
  }
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature') ?? '';
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return json({ error: signature ? 'Invalid signature' : 'Missing signature' }, 401);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid payload' }, 400);
  }

  if (payload?.event === 'charge.success') {
    const { reference, amount, currency } = payload.data ?? {};
    if (typeof reference === 'string' && currency === 'NGN' && Number(amount) >= FEES.submission.kobo) {
      try {
        const { error } = await adminClient()
          .from('estates')
          .update({ payment_status: 'paid' })
          .eq('paystack_reference', reference)
          .eq('payment_status', 'unpaid');
        if (error && isMissingSchema(error)) {
          console.warn('[paystack-webhook] estates.payment_status missing — run migration 0004. Event acknowledged.');
        } else if (error) {
          console.error('[paystack-webhook] update failed:', error.message);
          return json({ error: 'Database update failed' }, 500); // Paystack will retry
        }
      } catch (err) {
        console.error('[paystack-webhook] error:', err instanceof Error ? err.message : err);
        return json({ error: 'Server error' }, 500);
      }
    }
  }
  return json({ received: true });
}
