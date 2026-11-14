import { HttpError, assertUuid, json, readJson, route } from '@/lib/server/http';
import { isEstateAccountName, matchesDeceasedName } from '@/lib/server/names';
import { paystackGet } from '@/lib/server/paystack';
import { requireOwnEstate, requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

interface ResolveResponse {
  status: boolean;
  message: string;
  data?: { account_number: string; account_name: string };
}

/**
 * POST /api/verify-estate-nuban        (signed-in owner of the case only)
 * Body: { estate_id, accountNumber, bankCode }
 *
 * The anti-fraud gate before any payout: asks the bank who owns the
 * destination account and passes it only if it is an ESTATE account in the
 * deceased's name, e.g. "ESTATE OF LATE SAMUEL BELLO".
 *
 * The name to match comes from the case on file, never from the request, and
 * sharing a surname is not enough — a relative's personal account fails.
 */
export const POST = route('verify-estate-nuban', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ estate_id?: string; estateId?: string; accountNumber?: string; bankCode?: string }>(request);
  const accountNumber = String(body.accountNumber ?? '').trim();
  const bankCode = String(body.bankCode ?? '').trim();
  if (!/^\d{10}$/.test(accountNumber)) throw new HttpError(400, 'Account number must be exactly 10 digits.', 'INVALID_ACCOUNT');
  if (!/^\d{3,6}$/.test(bankCode)) throw new HttpError(400, 'Please choose a bank.', 'INVALID_BANK');
  const estate = await requireOwnEstate(user.id, assertUuid(body.estate_id ?? body.estateId, 'case id'));

  const { ok, body: resolved } = await paystackGet<ResolveResponse>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  if (!ok || !resolved?.status || !resolved.data) {
    throw new HttpError(422, 'The bank could not find that account. Please check the account number and bank.', 'ACCOUNT_NOT_RESOLVED');
  }

  const accountName = resolved.data.account_name;
  const name = matchesDeceasedName(accountName, estate.deceased_name);
  const estateAccount = isEstateAccountName(accountName);

  if (!name.matched || !estateAccount) {
    console.warn(`[verify-estate-nuban] blocked payout account for estate ${estate.id}: nameMatch=${name.matched} estateAccount=${estateAccount}`);
    throw new HttpError(
      422,
      !name.matched
        ? `This account is not in the name of ${estate.deceased_name}. Funds can only be paid into the estate's own account.`
        : 'This looks like a personal account. Funds can only be paid into an estate account opened with the Letters of Administration (for example "Estate of Late …").',
      !name.matched ? 'NUBAN_NAME_MISMATCH' : 'NOT_AN_ESTATE_ACCOUNT',
      { resolved_name: accountName },
    );
  }

  return json({ success: true, verified: true, resolved_name: accountName, account_number: resolved.data.account_number });
});
