import { HttpError, assertUuid, json, readJson, route } from '@/lib/server/http';
import { mono } from '@/lib/server/mono';
import { adminClient, requireOwnEstate, requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

const MAX_PER_HOUR = 3;
const maskBvn = (bvn: string) => `${bvn.slice(0, 3)}*****${bvn.slice(-3)}`;

/**
 * POST /api/igree/request-otp        (signed-in owner of an approved case only)
 * Body: { bvn, estate_id }
 *
 * Starts a consented BVN lookup and sends the one-time code to the phone
 * number registered on that BVN.
 *
 * Limited to 3 requests an hour per account (not per IP address, which a
 * caller can fake). The BVN itself is never written to our logs.
 */
export const POST = route('request-otp', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ bvn?: string; estate_id?: string; estateId?: string }>(request);
  const bvn = String(body.bvn ?? '').trim();
  if (!/^\d{11}$/.test(bvn)) throw new HttpError(400, 'A BVN is exactly 11 digits.', 'INVALID_BVN');

  const estate = await requireOwnEstate(user.id, assertUuid(body.estate_id ?? body.estateId, 'case id'));
  if (estate.status !== 'verified') throw new HttpError(409, 'Account discovery opens once our team has approved your documents.', 'NOT_APPROVED');
  if (!estate.mandate_acknowledged) throw new HttpError(409, 'Please prepare your bank letter first.', 'LETTER_REQUIRED');

  const supabase = adminClient();
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: countError } = await supabase
    .from('bvn_request_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if (countError) {
    console.error('[request-otp] rate limit check failed:', countError.message);
    throw new HttpError(500, 'We could not start the search. Please try again.', 'DB_ERROR');
  }
  if ((count ?? 0) >= MAX_PER_HOUR) throw new HttpError(429, 'You have requested several codes in a short time. Please wait an hour and try again.', 'RATE_LIMITED');

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const log = (status: string) => supabase.from('bvn_request_logs').insert({ ip_address: ip, user_id: user.id, bvn: maskBvn(bvn), status });

  const init = await mono('/v2/lookup/bvn/initiate', { bvn, scope: 'bank_accounts' });
  // Mono nests the session under `data`; accept a top-level id too for safety.
  const sessionId: string | undefined = init.data?.data?.session_id ?? init.data?.session_id;
  if (!init.ok || !sessionId) {
    await log('failed_initiate');
    console.warn('[request-otp] initiate failed:', init.status, init.data?.message);
    throw new HttpError(init.status === 400 || init.status === 404 ? 422 : 502, 'We could not start a search for that BVN. Please check the number and try again.', 'BVN_LOOKUP_FAILED');
  }

  const methods: Array<{ method: string; hint?: string }> = init.data?.data?.methods ?? [];
  const chosen = methods.find((m) => m.method === 'phone') ?? methods.find((m) => /phone/.test(m.method)) ?? methods[0] ?? { method: 'phone' };

  const sent = await mono('/v2/lookup/bvn/verify', { method: chosen.method }, sessionId);
  if (!sent.ok) {
    await log('failed_verify');
    console.warn('[request-otp] verify failed:', sent.status, sent.data?.message);
    throw new HttpError(502, 'We could not send the code. Please try again in a few minutes.', 'OTP_SEND_FAILED');
  }
  await log('success');

  return json({ success: true, sessionId, sentTo: chosen.hint ?? sent.data?.message ?? 'the phone number registered on this BVN' });
});
