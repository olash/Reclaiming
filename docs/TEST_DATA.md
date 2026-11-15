# Test data for every flow

All values below are the providers' **sandbox** data. They only work with test keys and involve no real money or identities. The Mono and QoreID values were confirmed against the live sandboxes from a Reclaiming preview on 14 November 2026.

Access is role-based. Run the journey with **two accounts**:

| Role | Where they log in | What they see |
| --- | --- | --- |
| Family member | `/login` (any email or Google account that is **not** the admin) | Their cases, the wizard, recovered funds. Never the review console. |
| Admin (reviewer) | `/admin/login` with **damilolash@gmail.com**, the only address in `ADMIN_EMAILS` | Only the review console at `/admin`. If they open the family app, they are taken back to the console. |

---

## 1. About you: QoreID NIN check (₦5,000 step)

QoreID's documented test identity. Our live check returned `EXACT_MATCH`.

| Field | Enter |
| --- | --- |
| First name | **Bunch** |
| Last name | **Dillon** |
| NIN | **63184876213** |
| Date of birth | **6 January 1974** (any adult date also passes the name match) |
| Mobile number | **08000000000** (any valid number works) |

Use the exact spelling of the names: the check compares them with the NIN record.

## 2. Payments: Paystack test cards

Official cards from Paystack's Test Payments page:

| Card number | CVV | Expiry | PIN / OTP | Result |
| --- | --- | --- | --- | --- |
| **4084 0840 8408 4081** | **408** | any future date | none | Success, no extra steps (use this one) |
| 5060 6666 6666 6666 666 | 123 | any future date | PIN **1234**, OTP **123456** | Success after PIN and OTP |
| 5078 5078 5078 5078 12 | see Paystack’s page | any future date | PIN **1111** | Success after PIN |
| 4084 0800 0067 1803 | any | any future date | OTP **123456** | Declined (tests the failure message) |

You can also pick **Bank** or **Transfer** in the Paystack window and follow its on-screen test instructions.

## 3. Selfie check: QoreID liveness

Use your own face on a real camera. `liveness_nin` compares the selfie with the photo on the NIN record, and the test NIN has no real photo. If the sandbox rejects the match, set `LIVENESS_MODE` and `NEXT_PUBLIC_LIVENESS_MODE` to `optional` in Vercel and redeploy. A **Skip for now** button then appears.

## 4. Documents

Any clear PDF, JPG or PNG under 10 MB as the death certificate. Letters of Administration are optional.

## 5. Find accounts: Mono BVN lookup (NIBSS iGree)

| Step | Enter |
| --- | --- |
| Their BVN | **12345678901** |
| Where to send the code | Any option. For "Text message to another phone number", use **09066662020**. |
| One-time code | **123456** |

**What the sandbox returns: accounts** (`scope: bank_accounts`, the one Reclaiming uses):

| Bank | Account number | Account name | Type |
| --- | --- | --- | --- |
| First Bank | 1234567890 | Samuel Olamide | Savings |
| Zenith Bank | 1234509384 | Olamide Samuel | Current |

**What the sandbox returns: "Fetch BVN Details"** (`scope: identity`):

| Field | Sandbox value |
| --- | --- |
| Name | **Samuel Nomo Olamide** (first: Samuel, middle: Nomo, last: Olamide) |
| BVN | 12345678901 |
| Date of birth | 2020-01-06 |
| Gender | Male |
| Phone | 08012345616 |
| Email | nomo@test.com |
| State / LGA of origin | Lagos State / yaba |
| NIN | 000000000 |

Contact hints shown on the "send the code" step: email `test**email@gmail.com`, phone `0803***3843`, or "another phone number".

To see this data live at any time, open `/api/diagnostics?only=mono` on a **preview** deployment. It is disabled on production, and it only shows sandbox data when a Mono **test** key is set.

## 6. Review queue (reviewer account)

Go to `/admin/login` (or **Team login** in the site footer), log in as **damilolash@gmail.com**, then **Approve**. A family account that tries this login is refused and signed out; at `/admin` it sees only "page not found".

---

### Other providers' test values

Not used by Reclaiming today, but handy when comparing providers:

| Provider | Test BVN | Notes |
| --- | --- | --- |
| QoreID BVN | 22222222222 | Bunch Dillon. iGree BVN is not enabled on our QoreID test account. |
| Dojah | 22222222222 (BVN), 70123456789 (NIN) | Dojah sandbox |
| Flutterwave BVN consent | 22222222280 | Flutterwave sandbox |
