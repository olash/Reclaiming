/**
 * @file app/api/verify-estate-nuban/route.ts
 * @description Payout NUBAN Gate Validation — prevents fraud before any funds are swept
 *              from escrow to an external account.
 *
 * FLOW:
 *  1. Accept a POST payload: { accountNumber, bankCode, expectedDeceasedName }
 *  2. Proxy the account number + bank code to Paystack's Account Resolution API.
 *  3. Apply fuzzy name-match logic: the resolved account name must either contain
 *     the word "Estate" OR substantially match the deceased's name on record.
 *  4. Return 200 on pass, 422 on mismatch, 400/500 on error.
 *
 * SECURITY NOTE: The Paystack secret key is NEVER exposed to the client.
 *                All calls to Paystack happen server-side only.
 */

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

interface NubanValidationPayload {
  /** The 10-digit NUBAN account number to validate */
  accountNumber: string;
  /** The CBN bank code (e.g. "058" for GTBank) */
  bankCode: string;
  /**
   * The full legal name of the deceased as recorded in the estate file.
   * The bank-resolved account name will be compared against this.
   */
  expectedDeceasedName: string;
}

interface PaystackResolveResponse {
  status:  boolean;
  message: string;
  data?: {
    account_number: string;
    account_name:   string;
    bank_id:        number;
  };
}

// ---------------------------------------------------------------------------
// Helper: Normalise a name string for loose comparison
// Strips punctuation, lowercases, and collapses whitespace.
// ---------------------------------------------------------------------------

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether *any* word in `query` appears inside `target`.
 * This guards against exact-match failures caused by name ordering
 * differences (e.g. "Adeyemi John" vs "John Adeyemi") or missing
 * middle names, which are common in Nigerian estate accounts.
 */
function fuzzyNameMatch(target: string, query: string): boolean {
  const normTarget = normaliseName(target);
  const normQuery  = normaliseName(query);

  // Exact substring match
  if (normTarget.includes(normQuery) || normQuery.includes(normTarget)) {
    return true;
  }

  // Token intersection: at least one significant word must appear in both
  const significantWords = normQuery.split(' ').filter(w => w.length > 2);
  return significantWords.some(word => normTarget.includes(word));
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    // -----------------------------------------------------------------------
    // 1. Parse & Validate Payload
    // -----------------------------------------------------------------------
    let body: NubanValidationPayload;

    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { accountNumber, bankCode, expectedDeceasedName } = body;

    if (!accountNumber?.trim() || !bankCode?.trim() || !expectedDeceasedName?.trim()) {
      return new Response(
        JSON.stringify({
          error: '`accountNumber`, `bankCode`, and `expectedDeceasedName` are all required.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Basic NUBAN format guard (must be exactly 10 digits)
    if (!/^\d{10}$/.test(accountNumber)) {
      return new Response(
        JSON.stringify({ error: 'Account number must be exactly 10 digits.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Retrieve the Paystack Secret Key from Environment
    //    (never exposed to the client)
    // -----------------------------------------------------------------------
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackSecret) {
      console.error('[verify-estate-nuban] PAYSTACK_SECRET_KEY is not configured.');
      return new Response(
        JSON.stringify({ error: 'Payment gateway configuration error.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // -----------------------------------------------------------------------
    // 3. Proxy Request → Paystack Account Resolution API
    // -----------------------------------------------------------------------
    const paystackUrl =
      `https://api.paystack.co/bank/resolve` +
      `?account_number=${encodeURIComponent(accountNumber)}` +
      `&bank_code=${encodeURIComponent(bankCode)}`;

    const paystackResponse = await fetch(paystackUrl, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Cache-Control': 'no-cache',
      },
    });

    const paystackData: PaystackResolveResponse = await paystackResponse.json();

    // Handle upstream Paystack errors
    if (!paystackResponse.ok || !paystackData.status || !paystackData.data) {
      console.warn('[verify-estate-nuban] Paystack resolution failed:', paystackData.message);
      return new Response(
        JSON.stringify({
          error:   'Bank account could not be resolved.',
          details: paystackData.message ?? 'No additional details from payment gateway.',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resolvedAccountName = paystackData.data.account_name;

    // -----------------------------------------------------------------------
    // 4. Fuzzy Name-Match Validation (Anti-Fraud Gate)
    //
    //    PASS if the resolved account name:
    //      a) Contains the word "Estate" (indicates a proper estate account), OR
    //      b) Substantially matches the expectedDeceasedName (token intersection)
    //
    //    FAIL (HTTP 422) otherwise — this stops payouts to personal accounts.
    // -----------------------------------------------------------------------
    const containsEstateKeyword = /\bestate\b/i.test(resolvedAccountName);
    const nameMatchesPassed     = fuzzyNameMatch(resolvedAccountName, expectedDeceasedName);

    if (!containsEstateKeyword && !nameMatchesPassed) {
      console.warn(
        `[verify-estate-nuban] Name mismatch. ` +
        `Resolved: "${resolvedAccountName}" | Expected: "${expectedDeceasedName}"`
      );

      return new Response(
        JSON.stringify({
          error:           'Name validation mismatch.',
          code:            'NUBAN_NAME_MISMATCH',
          resolved_name:   resolvedAccountName,
          expected_pattern: expectedDeceasedName,
          message:
            'The account holder name returned by the bank does not match the ' +
            'registered estate name on file. Payout has been blocked to prevent fraud. ' +
            'Please ensure you are transferring to a court-certified estate account.',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // -----------------------------------------------------------------------
    // 5. Validation Passed — Return Verified Account Details
    // -----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        success:         true,
        verified:        true,
        resolved_name:   resolvedAccountName,
        account_number:  paystackData.data.account_number,
        match_method:    containsEstateKeyword ? 'estate_keyword' : 'name_token_match',
        message:         'Account verified successfully. Payout may proceed.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[verify-estate-nuban] Unexpected error:', message);

    return new Response(
      JSON.stringify({
        error:  'Internal server error during NUBAN validation.',
        detail: message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
