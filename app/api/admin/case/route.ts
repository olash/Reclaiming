import { HttpError, assertUuid, json, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/admin';
import { adminClient } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/case        (review team only)
 * Body: { estate_id }
 * One case with short-lived (10 minute) links to open its documents.
 */
export const POST = route('admin-case', async (request) => {
  await requireAdmin(request);
  const { estate_id } = await readJson<{ estate_id?: string }>(request);
  const db = adminClient();
  const { data, error } = await db.from('estates').select('*').eq('id', assertUuid(estate_id, 'case id')).limit(1);
  if (error) throw error;
  const estate = data?.[0];
  if (!estate) throw new HttpError(404, 'Case not found.', 'ESTATE_NOT_FOUND');

  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: signed, error: e } = await db.storage.from('probate_documents').createSignedUrl(path, 600);
    if (e) {
      console.warn('[admin-case] could not sign', path, e.message);
      return null;
    }
    return signed?.signedUrl ?? null;
  };

  return json({
    estate,
    documents: {
      death_certificate: await sign(estate.death_certificate_path),
      letter_of_administration: await sign(estate.letter_of_administration_path),
    },
  });
});
