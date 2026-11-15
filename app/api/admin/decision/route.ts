import { HttpError, assertUuid, json, readJson, route } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/admin';
import { adminClient, isMissingSchema } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

const ACTIONS = {
  start_review: { status: 'under_review' },
  approve: { status: 'verified' },
  reject: { status: 'rejected' },
  reopen: { status: 'pending_review' },
  settle: { status: 'settled' },
} as const;

/**
 * POST /api/admin/decision        (review team only)
 * Body: { estate_id, action: start_review | approve | reject | reopen | settle, note?, amount? }
 *
 * - reject needs a note: the family sees it on their case page.
 * - settle records the net amount released to the estate (₦).
 */
export const POST = route('admin-decision', async (request) => {
  const reviewer = await requireAdmin(request);
  const body = await readJson<{ estate_id?: string; action?: keyof typeof ACTIONS; note?: string; amount?: number | string }>(request);
  const id = assertUuid(body.estate_id, 'case id');
  const action = body.action && ACTIONS[body.action];
  if (!action) throw new HttpError(400, 'Unknown action.', 'INVALID_ACTION');

  const note = String(body.note ?? '').trim().slice(0, 1000);
  if (body.action === 'reject' && note.length < 10) throw new HttpError(400, 'Tell the family what to fix (at least a sentence).', 'NOTE_REQUIRED');
  const amount = body.amount === undefined || body.amount === '' ? null : Number(body.amount);
  if (body.action === 'settle' && (amount === null || !Number.isFinite(amount) || amount < 0)) throw new HttpError(400, 'Enter the amount released to the estate.', 'AMOUNT_REQUIRED');

  const db = adminClient();
  const { data: rows, error: findError } = await db.from('estates').select('id, status').eq('id', id).limit(1);
  if (findError) throw findError;
  if (!rows?.[0]) throw new HttpError(404, 'Case not found.', 'ESTATE_NOT_FOUND');

  const { error } = await db.from('estates').update({ status: action.status }).eq('id', id);
  if (error) {
    console.error('[admin-decision] update failed:', error.message);
    throw new HttpError(500, error.code === '23514' ? 'The database does not accept this status yet — run migration 0005.' : 'Could not save the decision.', 'DB_ERROR');
  }

  // Optional columns (migration 0005): saved when present.
  const extras: Record<string, unknown> = {};
  if (body.action === 'reject' || body.action === 'approve' || body.action === 'reopen') extras.review_note = body.action === 'reject' ? note : null;
  if (body.action === 'settle') extras.total_asset_value = amount;
  let extrasSaved = true;
  if (Object.keys(extras).length) {
    const { error: e } = await db.from('estates').update(extras).eq('id', id);
    if (e) {
      extrasSaved = false;
      if (!isMissingSchema(e)) console.warn('[admin-decision] extras not saved:', e.message);
    }
  }
  console.log(`[admin-decision] ${reviewer.email} → ${body.action} on ${id}`);
  return json({ success: true, status: action.status, extrasSaved });
});
