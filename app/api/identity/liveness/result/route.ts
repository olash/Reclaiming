import { HttpError, json, readJson, route } from '@/lib/server/http';
import { latestVerification, saveProfile } from '@/lib/server/identity';
import { requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/** Keeps only small, non-biometric fields from the SDK's event detail. */
function summarise(detail: unknown): Record<string, unknown> {
  if (!detail || typeof detail !== 'object') return {};
  const out: Record<string, unknown> = {};
  const walk = (obj: Record<string, unknown>, prefix = '', depth = 0) => {
    for (const [k, v] of Object.entries(obj)) {
      if (/photo|image|selfie|base64|signature|face(map|scan)/i.test(k)) continue;
      const key = prefix + k;
      if (v && typeof v === 'object' && !Array.isArray(v) && depth < 2) walk(v as Record<string, unknown>, `${key}.`, depth + 1);
      else if (['string', 'number', 'boolean'].includes(typeof v) && String(v).length < 120) out[key] = v;
    }
  };
  walk(detail as Record<string, unknown>);
  return Object.fromEntries(Object.entries(out).slice(0, 40));
}

/**
 * POST /api/identity/liveness/result        (signed-in users)
 * Body: { reference, outcome: 'submitted' | 'error', detail? }
 *
 * Records what the QoreID Web SDK reported for the session this server
 * started. The full result (including the face match score) is also kept
 * on QoreID's side and visible in the QoreID portal's API logs under the
 * same reference.
 */
export const POST = route('liveness-result', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ reference?: string; outcome?: string; detail?: unknown }>(request);
  const row = await latestVerification(user.id);
  const live = row?.profile_data?.liveness;
  if (!row || !live || live.reference !== body.reference) throw new HttpError(409, 'That selfie check has expired. Please start it again.', 'LIVENESS_SESSION_MISMATCH');
  if (live.status === 'submitted') return json({ status: 'submitted' });

  const result = summarise(body.detail);
  console.log('[liveness] result for', live.reference, JSON.stringify(Object.keys(result)));
  const failed = body.outcome !== 'submitted' || /fail|reject|mismatch|spoof/i.test(String(result.status ?? result['status.status'] ?? result.state ?? ''));
  await saveProfile(row, {
    liveness: {
      ...live,
      status: failed ? 'failed' : 'submitted',
      completed_at: new Date().toISOString(),
      result,
      message: failed ? String(result.message ?? result.error ?? 'The selfie check did not complete.') : undefined,
    },
  });
  return json({ status: failed ? 'failed' : 'submitted' });
});
