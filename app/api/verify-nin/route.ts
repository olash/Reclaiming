import { getQoreIdToken } from '@/utils/qoreidAuth';
import { FEES } from '@/lib/fees';
import { HttpError, json, readJson, route } from '@/lib/server/http';
import { assertPaid, findLedgerEntry, recordLedgerEntry } from '@/lib/server/paystack';
import { adminClient, requireUser } from '@/lib/server/supabase';
import { normaliseName } from '@/lib/server/names';

export const dynamic = 'force-dynamic';

const CACHE_DAYS = 30;
const same = (a?: string | null, b?: string | null) => !!a && !!b && normaliseName(a) === normaliseName(b);

/** Drops bulky biometric blobs before a KYC record is stored (data minimisation, NDPA 2023 s.24). */
function minimise(payload: any) {
  const copy = JSON.parse(JSON.stringify(payload ?? {}));
  for (const holder of [copy, copy.nin, copy.details, copy.data]) {
    if (holder && typeof holder === 'object') for (const k of ['photo', 'image', 'signature']) delete holder[k];
  }
  return copy;
}

/**
 * POST /api/verify-nin        (signed-in users only)
 * Body: { nin, firstname, lastname, phone?, dob?, payment_reference? }
 *
 * Confirms that the NIN belongs to the person named. The ₦5,000 identity fee
 * is checked with Paystack on the server. A verification made in the last 30
 * days for the same person is reused, so nobody pays twice.
 *
 * Calling it WITHOUT a payment_reference is a free pre-check: it answers 200
 * (already verified), 409 (NIN belongs to another account) or 402 (payment
 * needed), so the app only opens checkout when a payment is really required.
 *
 * The identity provider's raw record is never returned to the browser.
 */
export const POST = route('verify-nin', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ nin?: string; firstname?: string; lastname?: string; phone?: string; dob?: string; payment_reference?: string }>(request);

  const nin = String(body.nin ?? '').trim();
  const firstname = String(body.firstname ?? '').trim();
  const lastname = String(body.lastname ?? '').trim();
  if (!/^\d{11}$/.test(nin)) throw new HttpError(400, 'Your NIN should be exactly 11 digits.', 'INVALID_NIN');
  if (!firstname || !lastname) throw new HttpError(400, 'Please enter your first and last name exactly as they appear on your NIN slip.', 'NAME_REQUIRED');

  const supabase = adminClient();

  // ── Reuse a recent verification for the same person ("never pay twice") ──
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data: cached } = await supabase
    .from('verifications')
    .select('id, profile_data, created_at')
    .eq('nin', nin)
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  const hit = cached?.[0];
  const cachedName = hit?.profile_data?.applicant;
  if (hit && same(cachedName?.firstname, firstname) && same(cachedName?.lastname, lastname)) {
    return json({ verified: true, cached: true, verified_at: hit.created_at, name: { firstname, lastname } });
  }

  // ── One NIN, one account ─────────────────────────────────────────────────
  // Checked BEFORE payment so nobody is charged for a check that cannot be saved.
  const { data: elsewhere } = await supabase.from('verifications').select('user_id').eq('nin', nin).neq('user_id', user.id).limit(1);
  if (elsewhere?.length) {
    throw new HttpError(409, 'This NIN is already linked to another Reclaimng account. Log in with that account, or message our team and we will sort it out.', 'NIN_IN_USE');
  }

  // ── Payment: confirmed with Paystack, and not already spent ──────────────
  const payment = await assertPaid({ reference: body.payment_reference, purpose: 'identity', userId: user.id, email: user.email });
  const ledger = await findLedgerEntry(payment.reference);
  if (ledger && (ledger.user_id !== user.id || ledger.purpose !== 'identity' || ledger.status === 'used')) {
    throw new HttpError(402, 'That payment has already been used. Please make a new payment to continue.', 'PAYMENT_ALREADY_USED');
  }

  // ── Ask the identity provider ────────────────────────────────────────────
  const accessToken = await getQoreIdToken().catch(() => {
    throw new HttpError(503, 'Our identity partner is not reachable right now. You have not lost your payment — please try again shortly.', 'IDENTITY_PROVIDER_DOWN');
  });
  const res = await fetch(`https://api.qoreid.com/v1/ng/identities/nin-premium/${nin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ firstname, lastname, phone: body.phone ?? '', dob: body.dob ?? '' }),
    cache: 'no-store',
  });
  const data: any = await res.json().catch(() => ({}));

  if (res.status === 404) throw new HttpError(422, 'We could not find that NIN. Please check the number and try again.', 'NIN_NOT_FOUND');
  if (!res.ok) {
    console.error('[verify-nin] provider returned', res.status);
    throw new HttpError(502, 'Our identity partner could not complete the check. You have not lost your payment — please try again shortly.', 'IDENTITY_PROVIDER_ERROR');
  }

  const check = data.summary?.nin_check ?? data.details?.summary?.nin_check;
  const verified =
    check?.status === 'EXACT_MATCH' || data.status?.status === 'verified' || data.matchStatus?.status === 'verified';
  if (!verified) {
    // Tell the person which detail to fix, but never echo the registry record itself.
    const fields = check?.fieldMatches ?? {};
    const wrong = Object.entries(fields).filter(([, ok]) => ok === false).map(([k]) => k);
    throw new HttpError(422, 'The details you entered do not match the record for this NIN. Check the spelling of your names against your NIN slip and try again.', 'NAME_MISMATCH', { mismatched_fields: wrong });
  }

  // ── Store the KYC record (without photo/signature blobs) ─────────────────
  const record = { ...minimise(data), applicant: { firstname, lastname }, _payment_reference: payment.reference };
  const { data: existing } = await supabase.from('verifications').select('id').eq('nin', nin).eq('user_id', user.id).limit(1);
  const now = new Date().toISOString();
  const write = existing?.[0]
    ? await supabase.from('verifications').update({ profile_data: record, created_at: now }).eq('id', existing[0].id)
    : await supabase.from('verifications').insert({ user_id: user.id, nin, profile_data: record, created_at: now });
  if (write.error) {
    // Without a stored record the next step would refuse the user, so do not claim success or spend the payment.
    console.error('[verify-nin] KYC record not stored:', write.error.code, write.error.message);
    throw new HttpError(500, 'Your identity was confirmed but we could not save the result. You have not lost your payment — please try again.', 'DB_ERROR');
  }
  await recordLedgerEntry({ user_id: user.id, reference: payment.reference, purpose: 'identity', amount_kobo: FEES.identity.kobo });

  return json({ verified: true, cached: false, verified_at: now, name: { firstname, lastname } });
});
