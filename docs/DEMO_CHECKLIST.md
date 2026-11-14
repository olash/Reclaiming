# Hackathon demo checklist

Everything below is a setting in one of your dashboards. Nothing needs code. Do it in order and allow about 30 minutes, then do one full dry run on Sunday.

## 1. Supabase: run the two pending migrations (5 min)

Live diagnostics show that your database has never run migration **0004** (`estates.payment_status` is missing) or **0005**. The app copes without them, but cases can't be marked "settled" and rejection notes aren't stored.

Supabase → SQL Editor → New query. Paste and run **each file in order**:

1. `supabase/migrations/0004_payment_status.sql`
2. `supabase/migrations/0005_redesign.sql`

Both are safe to re-run.

## 2. Mono: create a Lookup app (5 min)

Your current Mono key belongs to an app without the Lookup product. Mono's API answered: *"Please use a Lookup app… create an app with Lookup product."*

Mono dashboard → Apps → Create app → choose **Lookup** → copy the **test** secret key. Then put it in Vercel as `MONO_SEC_KEY` (step 3). Sandbox mode doesn't need KYB.

## 3. Vercel: environment variables (5 min)

Project `reclaiming` → Settings → Environment Variables. Apply each to **Production and Preview**:

| Name | Value |
| --- | --- |
| `MONO_SEC_KEY` | the Lookup app's test secret key from step 2 |
| `ADMIN_EMAILS` | the email(s) you will log in with to approve cases, comma-separated |
| `LIVENESS_MODE` and `NEXT_PUBLIC_LIVENESS_MODE` | `required`. Switch both to `optional` if the selfie check misbehaves on the day (see 7). |

Keep the rest as they are; diagnostics confirmed they work. Redeploy after saving, because `NEXT_PUBLIC_` values are baked in at build time.

## 4. Supabase Auth: redirect URLs and sign-up (3 min)

Supabase → Authentication → URL Configuration:

- **Site URL:** `https://reclaiming.vercel.app`
- **Redirect URLs:** add `https://reclaiming.vercel.app/**` and `https://reclaiming-*-olashs-projects.vercel.app/**`

If a preview address is missing from this list, Google sign-in and email links from that preview land on the **Site URL** (production) instead. That is why logging in on a preview could drop you on `reclaiming.vercel.app`. If it still happens, also add the exact preview address, e.g. `https://reclaiming-git-claude-happy-galileo-4uh7cb-olashs-projects.vercel.app/**`.

Optional for the demo: Authentication → Sign In / Providers → Email → turn **off** "Confirm email", so new accounts work instantly on stage. It is currently on.

## 5. Vercel: let judges open the site (2 min)

All `*.vercel.app` addresses, **including production**, currently require logging in to your Vercel team. Judges would hit a Vercel login page.

Settings → Deployment Protection → Vercel Authentication → choose **Standard Protection**. That keeps previews private and makes `reclaiming.vercel.app` public. Alternatively, add a custom domain.

## 6. Ship it to production

The work is on branch `claude/happy-galileo-4uh7cb`. Its Vercel preview is ready to check now. When you're happy, merge it into `main` (or promote the preview in Vercel). Vercel then deploys it to `reclaiming.vercel.app`.

Then set Paystack → Settings → API Keys & Webhooks → **Test webhook URL** to `https://reclaiming.vercel.app/api/webhook/paystack`.

## 7. Check everything is green

Open `/api/diagnostics` on the preview. It runs live checks of Supabase, Paystack, QoreID and Mono with each provider's test data, and it is disabled on production. Every section should say `pass`, except QoreID's two optional products (see below).

## Demo script and test data

All of these are provider **sandbox** values. No real money or identities are involved.

| Step | What to enter |
| --- | --- |
| Sign up | any email you can open (or any email, if "Confirm email" is off) |
| About you (NIN check) | First name **Bunch**, last name **Dillon**, NIN **63184876213**, any phone, any adult date of birth. This is QoreID's documented test identity; our live check returned `EXACT_MATCH` for it. |
| ₦5,000 and ₦75,000 payments | Paystack's successful test card **4084 0840 8408 4081**, any future expiry, CVV **408**. If the checkout asks for a PIN or OTP, use the values on Paystack's "Test cards" docs page. |
| Selfie check | follow QoreID's camera prompts (see the note below) |
| Documents | any clear PDF or photo as the death certificate |
| Review queue | log in with an `ADMIN_EMAILS` address → **Review queue** → **Approve** |
| Find accounts | BVN **12345678901** → send the code to "another phone number" **09066662020** (or any option) → code **123456** |

**Selfie check on the day.** `liveness_nin` compares the live selfie with the photo on the NIN record. With a test NIN, the result depends on how QoreID's sandbox treats that comparison, which we could not exercise without a camera. Do one dry run on Sunday.
- If it passes: keep `required`.
- If it rejects your face against the test NIN: set `LIVENESS_MODE` and `NEXT_PUBLIC_LIVENESS_MODE` to `optional`, then redeploy. A "Skip for now" button appears and everything else works.

**Not enabled on your QoreID test account.** Neither is needed for the demo:
- `face_verification_nin` (server-side face match);
- BVN iGree (`bvn-with-consent`).
