import { HttpError } from './http';

/** Which QoreID SDK product runs the selfie check. `liveness_nin` = liveness + match against the NIN photo. */
export const LIVENESS_PRODUCT = process.env.QOREID_LIVENESS_PRODUCT || 'liveness_nin';

/**
 * Whether a passed selfie check is needed before documents can be sent.
 *   required (default) — must pass
 *   optional — offered, can be skipped
 *   off — not shown
 */
export function livenessMode(): 'required' | 'optional' | 'off' {
  const v = (process.env.LIVENESS_MODE || process.env.NEXT_PUBLIC_LIVENESS_MODE || 'required').toLowerCase();
  return v === 'optional' || v === 'off' ? v : 'required';
}

/**
 * Mints a short-lived, single-use QoreID SDK session token.
 * Docs: https://docs.qoreid.com/docs/sdk-session-tokens — HTTP Basic with clientId:secret, server-side only.
 */
export async function mintSdkSession(opts: { productCode: string; reference: string; subjectRef?: string; ttlSeconds?: number }) {
  const clientId = process.env.QOREID_CLIENT_ID;
  const secret = process.env.QOREID_CLIENT_SECRET;
  if (!clientId || !secret) throw new HttpError(503, 'Identity checks are not available right now.', 'NOT_CONFIGURED');
  let res: Response;
  try {
    res = await fetch('https://api.qoreid.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'Idempotency-Key': opts.reference,
      },
      body: JSON.stringify({ productCode: opts.productCode, reference: opts.reference, subjectRef: opts.subjectRef, ttlSeconds: opts.ttlSeconds ?? 600, maxAttempts: 3 }),
      cache: 'no-store',
    });
  } catch {
    throw new HttpError(502, 'We could not reach our identity partner. Please try again.', 'IDENTITY_PROVIDER_DOWN');
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.sdkSessionToken) {
    console.error('[qoreid] session mint failed', res.status, data?.message);
    if (res.status === 403) throw new HttpError(503, 'The selfie check is not switched on for our account yet. Please contact support.', 'PRODUCT_NOT_ENABLED');
    throw new HttpError(502, 'We could not start the selfie check. Please try again.', 'IDENTITY_PROVIDER_ERROR');
  }
  return { token: data.sdkSessionToken as string, expiresAt: data.expiresAt as string | undefined };
}
