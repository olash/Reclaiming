import { HttpError, json, route } from '@/lib/server/http';
import { requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/generate-qore-session        (signed-in users only)
 *
 * Mints a short-lived QoreID session token for the liveness widget.
 * Credentials stay on the server.
 */
export const POST = route('generate-qore-session', async (request) => {
  const user = await requireUser(request);
  const clientId = process.env.QOREID_CLIENT_ID;
  const clientSecret = process.env.QOREID_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new HttpError(503, 'Identity checks are not available right now.', 'NOT_CONFIGURED');

  const res = await fetch('https://api.qoreid.com/v1/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
    body: JSON.stringify({ productCode: 'liveness', reference: `usr_${user.id.slice(0, 8)}_${Date.now()}` }),
    cache: 'no-store',
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.sdkSessionToken) {
    console.error('[generate-qore-session] provider returned', res.status);
    throw new HttpError(502, 'We could not start the identity session. Please try again.', 'IDENTITY_PROVIDER_ERROR');
  }
  return json({ sdkSessionToken: data.sdkSessionToken });
});
