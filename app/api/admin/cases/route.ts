import { json, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/admin';
import { adminClient } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending_review', 'under_review', 'verified', 'rejected', 'settled'];

/**
 * POST /api/admin/cases        (review team only)
 * Body: { status?: one of pending_review | under_review | verified | rejected | settled }
 * Every family's cases, oldest waiting first, with what a reviewer needs at a glance.
 */
export const POST = route('admin-cases', async (request) => {
  await requireAdmin(request);
  const body = await readJson<{ status?: string }>(request).catch(() => ({}) as { status?: string });
  const db = adminClient();
  let query = db.from('estates').select('*').order('submitted_at', { ascending: true }).limit(200);
  if (body.status && STATUSES.includes(body.status)) query = query.eq('status', body.status);
  const { data: estates, error } = await query;
  if (error) throw error;

  const userIds = [...new Set((estates ?? []).map((e: any) => e.user_id))];
  const { data: kyc } = userIds.length ? await db.from('verifications').select('user_id, nin, profile_data, created_at').in('user_id', userIds) : { data: [] as any[] };
  const byUser = new Map<string, any>();
  for (const v of kyc ?? []) if (!byUser.has(v.user_id) || byUser.get(v.user_id).created_at < v.created_at) byUser.set(v.user_id, v);

  return json({
    cases: (estates ?? []).map((e: any) => {
      const v = byUser.get(e.user_id);
      const a = v?.profile_data?.applicant;
      return {
        id: e.id,
        estate_name: e.estate_name,
        deceased_name: e.deceased_name,
        status: e.status,
        payment_status: e.payment_status,
        submitted_at: e.submitted_at,
        updated_at: e.updated_at,
        applicant: a ? `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim() : null,
        nin_masked: v?.nin ? `${v.nin.slice(0, 3)}*****${v.nin.slice(-3)}` : null,
        liveness: v?.profile_data?.liveness?.status ?? 'none',
        has_letters: !!e.letter_of_administration_path,
        document_check: e.document_check ?? null,
        accounts: Array.isArray(e.discovered_accounts) ? e.discovered_accounts.length : 0,
        review_note: e.review_note ?? null,
        total_asset_value: e.total_asset_value ?? null,
      };
    }),
  });
});
