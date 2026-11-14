import { HttpError, assertUuid, json, readJson, route } from '@/lib/server/http';
import { adminClient, requireOwnEstate, requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/update-milestone        (signed-in owner of the case only)
 * Body: { estateId, mandateAcknowledged }
 *
 * Records that the family has downloaded their bank letter. Only possible
 * once our team has approved the case.
 */
export const POST = route('update-milestone', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ estateId?: string; mandateAcknowledged?: boolean }>(request);
  if (typeof body.mandateAcknowledged !== 'boolean') throw new HttpError(400, 'Missing required fields.', 'INVALID_BODY');
  const estate = await requireOwnEstate(user.id, assertUuid(body.estateId, 'case id'));
  if (estate.status !== 'verified' && estate.status !== 'settled') {
    throw new HttpError(409, 'This step opens once our team has finished reviewing your documents.', 'NOT_APPROVED');
  }

  const { error } = await adminClient().from('estates').update({ mandate_acknowledged: body.mandateAcknowledged }).eq('id', estate.id);
  if (error) {
    console.error('[update-milestone] update failed:', error.message);
    throw new HttpError(500, 'We could not save your progress. Please try again.', 'DB_ERROR');
  }
  return json({ success: true });
});
