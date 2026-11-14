# Replacing (or keeping) Mono for account discovery

_November 2026. Research for Reclaimng's "find every bank account linked to the deceased's BVN" step._

## What this step needs

Reclaimng needs one specific thing from a provider: **given a BVN, and with consent captured through NIBSS's iGree consent platform, return every bank account linked to that BVN.** Mono calls this "BVN Lookup, scope `bank_accounts`".

Since March 2023, the CBN has required consent through iGree before any provider can release BVN data. Every legitimate provider therefore runs the same basic flow: start a session, send an OTP to a contact registered on the BVN, then return the data.

## Why Mono asked for an NDPR certificate and an operating licence

You will meet the same request, in some form, from **every** provider that can return BVN-linked bank accounts. The reason is that NIBSS holds these providers accountable for who they pass BVN data to. That makes the onboarding check (KYB) a NIBSS requirement passed down, not something peculiar to Mono.

- **"NDPR certificate".** This usually means proof that you comply with Nigeria's data protection law: registration with the Nigeria Data Protection Commission (NDPC), plus a compliance audit filed through a licensed Data Protection Compliance Organisation (DPCO). Reclaimng processes NINs, BVNs, selfies and death certificates, so the law very likely requires this of it anyway. It is not a licence. It is a registration plus an audit, and it can be obtained in weeks. **Recommendation: start this now. It unlocks every provider below.**
- **"Operating licence".** Mono asks regulated businesses (banks, lenders, payment companies) for their CBN or SEC licence. Reclaimng isn't one of those, so there is no licence to show. What usually works is:
  - a written description of the use case: estate administrators tracing a deceased relative's accounts, with consent captured by OTP through iGree;
  - your CAC documents;
  - your NDPC registration;
  - if you have one, a letter from a licensed partner whose licence covers your activity (the "blanket" arrangement you described).

  Ask Mono's compliance team directly which of these they will accept in place of a licence, and get the answer in writing.

**One question to settle with any provider (and a lawyer).** iGree consent is designed to come from the BVN holder. In Reclaimng's case the holder has died, and the person who receives the OTP acts for the estate under Letters of Administration. Explain this up front; it is the question compliance teams are most likely to ask.

## The options

| Provider | Can it return BVN → linked bank accounts? | What we found | Fit |
| --- | --- | --- | --- |
| **Mono Lookup** (current) | **Yes**: `scope: bank_accounts`, full account numbers and the bank's NIP code. | Fully integrated in the app (v3 API). Sandbox is free and works today once you create a **Lookup** app. Production needs KYB. | Keep for the hackathon. Keep pursuing KYB. |
| **QoreID** (already onboarded) | **Not as documented.** Their BVN iGree endpoint returns identity only (name, date of birth, phone). | The consent link QoreID generates requests a `banking_data` scope from NIBSS, so the data may be available on request. | **Ask your QoreID account manager first.** If they can return linked accounts, you avoid a second provider and a second KYB. |
| **Adjutor (Lendsqr)** | **Yes**: consent-based. An OTP goes to the phone or email on the BVN, then the endpoint returns the linked bank accounts. | API key comes from creating an app on their dashboard. Their docs warn that OTPs can be delayed and that data can be incomplete. Onboarding requirements and pricing aren't public. | Strongest independent alternative. Trial it in sandbox. |
| **Prembly (Identitypass)** | **Partly**: an endpoint retrieves the banks linked to a BVN or phone number (`mode: BVN \| PHONE`). | Sample responses show **masked** account numbers (e.g. `000****111`) and no OTP consent step. | Useful to show which banks to write to, but masked numbers and an unclear consent flow limit it. Check carefully. |
| **Interswitch API Marketplace** | **Listed**: a "Bank Accounts Lookup" API and a "BVN iGree" API. | Enterprise onboarding with a formal go-live approval. Requirements aren't public. | Credible, but likely the heaviest onboarding. |
| **Dojah** | **No**: BVN/NIN identity, selfie matching and account-name lookup only. | Clear, self-serve compliance form (CAC certificate, MEMART, status report, utility bill, director ID and BVN). | Good for identity checks, not for account discovery. |

## Recommendation

1. **For Monday:** keep Mono in **sandbox**. Create a Lookup app in the Mono dashboard (steps below), and the whole account search works end to end with Mono's test data (BVN `12345678901`, OTP `123456`).
2. **This week:** ask QoreID whether their iGree integration can return linked bank accounts (`banking_data`). If yes, that is the lowest-friction production route.
3. **In parallel:** open an Adjutor (Lendsqr) account, test their consent-based account lookup in sandbox, and ask what onboarding they need from a non-lender.
4. **Regardless of provider:** register with the NDPC and file a DPCO compliance audit. Every provider will ask for it, and the law likely requires it of Reclaimng anyway.

## How a new provider plugs in

The app already isolates this step behind one interface: `lib/server/bvn-discovery.ts`.

```ts
interface BvnDiscoveryProvider {
  start(bvn): { sessionId, channels: [{ method, label, needsPhone }] }   // begin consent, list where the OTP can go
  sendCode(sessionId, method, phoneNumber?): { sentTo }                  // send the OTP
  fetchAccounts(sessionId, otp): DiscoveredAccount[]                      // exchange OTP for accounts
}
```

Adding Adjutor or a QoreID accounts product means writing those three functions and setting `BVN_PROVIDER=<name>`. The screens, the database and the PDF schedule stay as they are.

If a provider uses a **redirect** consent page instead of an OTP (as QoreID's iGree link does), the app needs one more small "continue on NIBSS's page" step. Allow about half a day.

## Create a Mono Lookup app (sandbox)

The live check of your current key returned: *"Please use a Lookup app, go to your dashboard and create an app with Lookup product."*

1. Mono dashboard → **Apps** → **Create app**.
2. Choose the **Lookup** product (you can add others). Sandbox/test mode needs no KYB.
3. Copy the app's **test secret key** (`test_sk_…`).
4. Vercel → project `reclaiming` → Settings → Environment Variables → set `MONO_SEC_KEY` to that key for **Preview** and **Production**, then redeploy.
5. Open `/api/diagnostics?only=mono` on a preview deployment. All three Mono steps should pass.

## Sources

- [Mono — BVN iGree Lookup guide](https://docs.mono.co/docs/lookup/bvn-igree) and [sandbox test credentials](https://docs.mono.co/docs/sandbox)
- [QoreID — BVN iGree](https://docs.qoreid.com/docs/bvn-igree) and [introducing iGree](https://docs.qoreid.com/page/introducing-igree-the-new-bvn-consent-management-system)
- [Adjutor — Bank Verification Number endpoints](https://docs.adjutor.io/adjutor-api-endpoints/validation/bank-verification-number); [how to get all bank accounts linked to a BVN](https://adjutor.io/blogs/how-to-get-all-the-bank-accounts-linked-to-a-customers-bvn-in-nigeria)
- [Prembly / Identitypass — retrieve banks linked to BVN or phone](https://developer.myidentitypass.com/products/data-verification/nigeria/bank-account-verification-1/account-number-2.0-1)
- [Interswitch API Marketplace](https://developer.interswitchgroup.com/marketplace) and [KYC requirements](https://docs.interswitchgroup.com/docs/kyc-requirements)
- [Dojah — business compliance](https://docs.dojah.io/dashboard-guide/getting-started/compliance.md)
- [Mono blog — retrieving BVN data under the CBN–NIBSS consent layer](https://mono.co/blog/how-to-retrieve-bvn-data-cbn-nibss-consent-layer)
