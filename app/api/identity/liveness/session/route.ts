import { HttpError, json, route } from '@/lib/server/http';
import { latestVerification, saveProfile } from '@/lib/server/identity';
import { LIVENESS_PRODUCT, mintSdkSession } from '@/lib/server/qoreid';
import { requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/identity/liveness/session        (signed-in users whose NIN is verified)
 *
 * Starts QoreID's selfie liveness check, matched against the NIN photo
 * (product `liveness_nin`). Returns a single-use SDK token plus the details
 * the Web SDK needs; the reference is remembered so only this session's
 * result can be recorded.
 */
export const POST = route('liveness-session', async (request) => {
  const user = await requireUser(request);
  const row = await latestVerification(user.id);
  if (!row) throw new HttpError(409, 'Please confirm your NIN first.', 'IDENTITY_REQUIRED');

  const reference = `rc_live_${user.id.replace(/-/g, '').slice(0, 10)}_${Date.now()}`;
  const { token, expiresAt } = await mintSdkSession({ productCode: LIVENESS_PRODUCT, reference, subjectRef: user.id });
  await saveProfile(row, { liveness: { status: 'started', reference, product: LIVENESS_PRODUCT, started_at: new Date().toISOString() } });

  const applicant = row.profile_data?.applicant ?? {};
  return json({
    token,
    expiresAt,
    reference,
    applicant: { firstname: applicant.firstname ?? '', lastname: applicant.lastname ?? '', email: user.email ?? undefined },
    identity: { idType: 'nin', idNumber: row.nin, requiredIdType: 'nin' },
  });
});
