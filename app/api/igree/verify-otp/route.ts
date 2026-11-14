import { HttpError, assertUuid, json, readJson, route } from '@/lib/server/http';
import { bvnProvider } from '@/lib/server/bvn-discovery';
import { adminClient, requireOwnEstate, requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/igree/verify-otp        (signed-in owner of an approved case only)
 * Body: { sessionId, otp, estate_id }
 *
 * Exchanges the one-time code for the list of bank accounts linked to the
 * BVN and saves them on the caller's own case. Accounts found in an earlier
 * search are kept (merged by bank and account number). It never changes the
 * compliance status of the case.
 */
export const POST = route('verify-otp', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ sessionId?: string; otp?: string; estate_id?: string; estateId?: string }>(request);
  const sessionId = String(body.sessionId ?? '').trim();
  const otp = String(body.otp ?? '').trim();
  if (!sessionId || !/^\d{4,8}$/.test(otp)) throw new HttpError(400, 'Please enter the code we sent.', 'INVALID_OTP');

  const estate = await requireOwnEstate(user.id, assertUuid(body.estate_id ?? body.estateId, 'case id'));
  if (estate.status !== 'verified') throw new HttpError(409, 'Account discovery opens once our team has approved your documents.', 'NOT_APPROVED');

  const found = await bvnProvider().fetchAccounts(sessionId, otp);
  const previous = Array.isArray(estate.discovered_accounts) ? (estate.discovered_accounts as any[]) : [];
  const merged = new Map<string, any>();
  for (const a of [...previous, ...found]) merged.set(`${a.bank_code ?? a.bank_name}:${a.account_number}`, a);
  const accounts = [...merged.values()];

  const supabase = adminClient();
  const { error } = await supabase.from('estates').update({ discovered_accounts: accounts }).eq('id', estate.id);
  if (error) {
    console.error('[verify-otp] save failed:', error.message);
    throw new HttpError(500, 'We found the accounts but could not save them. Please try again.', 'DB_ERROR');
  }
  // Optional column from migration 0005.
  await supabase.from('estates').update({ discovery_completed_at: new Date().toISOString() }).eq('id', estate.id);

  return json({ success: true, accounts, newlyFound: found.length });
});
