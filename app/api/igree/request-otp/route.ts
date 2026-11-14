import { HttpError, assertUuid, json, readJson, route } from '@/lib/server/http';
import { bvnProvider } from '@/lib/server/bvn-discovery';
import { adminClient, requireOwnEstate, requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

const MAX_PER_HOUR = 5;
const maskBvn = (bvn: string) => `${bvn.slice(0, 3)}*****${bvn.slice(-3)}`;
const PHONE = /^(?:\+?234|0)[7-9][01]\d{8}$/;

/**
 * POST /api/igree/request-otp        (signed-in owner of an approved case only)
 *
 * Step 1 — body { bvn, estate_id }
 *   Starts a consented (NIBSS iGree) BVN search and returns where the
 *   one-time code can be sent: { sessionId, channels: [{ method, label, needsPhone }] }.
 *
 * Step 2 — body { sessionId, method, phone_number?, estate_id }
 *   Sends the code to the chosen channel: { sentTo }.
 *
 * Starting a search is limited to 5 an hour per account (not per IP, which
 * a caller can fake). The BVN is never written to our logs in full.
 */
export const POST = route('request-otp', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ bvn?: string; estate_id?: string; estateId?: string; sessionId?: string; method?: string; phone_number?: string }>(request);
  const estate = await requireOwnEstate(user.id, assertUuid(body.estate_id ?? body.estateId, 'case id'));
  if (estate.status !== 'verified') throw new HttpError(409, 'Account discovery opens once our team has approved your documents.', 'NOT_APPROVED');
  const provider = bvnProvider();

  // ── Step 2: send the code to the chosen channel ──────────────────────────
  if (body.sessionId) {
    const method = String(body.method ?? '').trim();
    if (!/^[a-z_0-9]{2,32}$/.test(method)) throw new HttpError(400, 'Please choose where the code should be sent.', 'INVALID_METHOD');
    let phone: string | undefined;
    if (method === 'alternate_phone') {
      phone = String(body.phone_number ?? '').replace(/[\s-]/g, '');
      if (!PHONE.test(phone)) throw new HttpError(400, 'Enter a Nigerian mobile number, like 0801 234 5678.', 'INVALID_PHONE');
    }
    const { sentTo } = await provider.sendCode(String(body.sessionId), method, phone);
    return json({ success: true, sentTo });
  }

  // ── Step 1: start the search ─────────────────────────────────────────────
  const bvn = String(body.bvn ?? '').trim();
  if (!/^\d{11}$/.test(bvn)) throw new HttpError(400, 'A BVN is exactly 11 digits.', 'INVALID_BVN');

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
  if ((count ?? 0) >= MAX_PER_HOUR) throw new HttpError(429, 'You have started several searches in a short time. Please wait an hour and try again.', 'RATE_LIMITED');

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const log = (status: string) => supabase.from('bvn_request_logs').insert({ ip_address: ip, user_id: user.id, bvn: maskBvn(bvn), status });

  try {
    const { sessionId, channels } = await provider.start(bvn);
    await log('initiated');
    return json({ success: true, sessionId, channels, provider: provider.name });
  } catch (err) {
    await log('failed_initiate');
    throw err;
  }
});
