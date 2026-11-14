# Reclaimng: status checklist

_Last updated 14 November 2026 (afternoon). Branch `claude/happy-galileo-4uh7cb` (pushed; not merged into `main`; no pull request)._

Legend:
- `[x]` done. `[ ]` not done. `[~]` done in code but not yet proven live.
- **Who:** 👤 you, in a dashboard or by sending a message · 🛠 code work · ⚖️ legal or compliance.
- **When:** 🔴 before Monday's demo · 🟠 before real users · 🟢 later.

---

## Part A — What has been done

### A1. Analysis and testing of the original platform
- [x] Read the whole codebase (12 HTML pages, 10 API routes, 4 SQL migrations) and the PRD.
- [x] Built local stand-ins for Supabase, Paystack, QoreID and Mono to test safely (`tests/mock/`).
- [x] Tested every original API route. Results:
  - 1 working;
  - 5 working but unsafe (no sign-in, fake payments accepted, other people's data writable);
  - 4 broken (document submission, Mono OTP, PDF reports, vault).
- [x] Drove every original user flow in a real browser and recorded what broke: password reset, Google return, refresh mid-wizard, fake liveness, Manage Recovery, BVN discovery, vault, filter tabs, phone layout.
- [x] Accessibility scan of the original pages: failures on 6 of 7.
- [x] Wrote `docs/ANALYSIS.md` with findings, before/after screenshots and an integration roadmap.
- [x] Found a Paystack test secret key in git history (commit `d5bec29`) and flagged it.

### A2. Redesign (front end)
- [x] Rebuilt the app on Next.js App Router with one design system (Tailwind + Radix, shadcn/ui style). Design references from Mobbin: Stripe, WeTransfer, Square, Basecamp, incident.io.
- [x] **Landing page** with how it works, what you'll need, clear pricing, safety and FAQ. Removed the unsubstantiated "CBN/SEC compliant" claims and the fake sample estate.
- [x] **Sign-in pages:**
  - log in, sign up, forgot password, and reset password (the reset link now actually works);
  - Google sign-in return fixed;
  - show/hide password;
  - the email already typed carries over to "forgot password".
- [x] **Home:** a case card per recovery, showing who has the next move and one clear action, with working filters and an empty state.
- [x] **Start a recovery**, a 5-step wizard:
  - answers survive a refresh;
  - nobody pays twice;
  - a free identity pre-check runs before payment;
  - plain-language errors, with focus moved to the problem;
  - pasted NINs are cleaned up.
- [x] **Case page:** a live status message, a progress timeline, documents on file, and WhatsApp help pre-filled with the case reference.
- [x] **Recovered funds** page (replaces the broken vault).
- [x] **Privacy** and **Terms** pages (your text, unchanged).
- [x] Old `*.html` links redirect to the new pages.
- [x] Security headers. The camera is allowed only for our page and QoreID's iframe (verified live).
- [x] Accessibility: **zero violations on 15 pages at desktop and phone widths** (WCAG 2.2 AA, axe-core). Also: 44px tap targets, skip link, reduced-motion support, no sideways scrolling on phones.

### A3. API hardening
- [x] Every route requires a signed-in user, except the public config route and the Paystack webhook (which is signature-checked).
- [x] The user is always taken from the session token, never from the request body.
- [x] Ownership checks: nobody can read or change another family's case.
- [x] Payments are verified **with Paystack on the server** (amount, currency, payer, purpose). A payments ledger stops one payment being spent twice.
- [x] Uploads: file type and 10 MB limit enforced, and documents are stored **only after** payment is confirmed.
- [x] Retrying a submission with the same payment returns the same case: no duplicate, no second charge.
- [x] Automatic document reading (OCR) is advisory only. It can never reject a family's submission.
- [x] Payout account check (`verify-estate-nuban`) rewritten: it blocks relatives who only share a surname and companies with "Estate" in their name.
- [x] Schedule of Assets PDF fixed (it crashed on "₦"), spans multiple pages, and is built from our records only.
- [x] Paystack webhook matches payments by reference, requires the full fee amount, and uses a constant-time signature check.
- [x] Rate limit on BVN searches is per account, not per IP (an IP can be faked).
- [x] BVNs are masked in logs, and photos are stripped from stored identity records.
- [x] The app keeps working on a database that is behind on migrations (proven against a copy of your live schema).

### A4. Integrations
- [x] **QoreID, NIN Premium:** integrated and **live-tested with your test keys**. The test identity returns `EXACT_MATCH` with the right names and `NO_MATCH` with wrong ones.
- [~] **QoreID, selfie liveness (`liveness_nin`, Web SDK):** integrated. **Live-tested:**
  - session tokens mint with your keys;
  - the SDK script loads;
  - the camera permission reaches QoreID's iframe.

  **Not yet tested:** a real face on a real camera.
- [~] **Mono, BVN account search (v3, `scope: bank_accounts`):** built to Mono's current docs, including choosing where the code goes (email, the BVN's phones, or an alternate phone). Tested against a stand-in that follows Mono's docs exactly. **Blocked live** because the Vercel key isn't from a Lookup app.
- [x] **Mono provider layer:** account search sits behind one interface (`lib/server/bvn-discovery.ts`), so another provider can be swapped in.
- [~] **Paystack:** test key live-tested and the checkout script loads. The real checkout popup has not been run end to end.
- [x] **Supabase:** migrations 0004 and 0005 applied and verified on the live project. Auth settings read: email and Google sign-in enabled, email confirmation on.
- [x] **Review console** (`/app/admin`, for staff in `ADMIN_EMAILS`):
  - a queue showing NIN and selfie results;
  - documents opened through 10-minute signed links;
  - approve, send back with a note, mark settled with an amount.
- [x] **Live diagnostics** endpoint (`/api/diagnostics`): checks all four services with your keys. Previews only; 404 on production.

### A5. Tests (run with `npm run test:serve`, then `npm test`)
- [x] 88 API tests, passing against three database states: fully migrated, before 0005, and your actual live schema.
- [x] 64 browser checks covering the whole journey: sign-up, wizard, payment stand-in, selfie stand-in, reviewer approval, account search, bank-letter fallback, PDFs, recovered funds, phone layout, log-out and log-in, password reset, Google return.
- [x] Accessibility scan of every page at two widths.

### A6. Documents written
- [x] `README.md`: overview, architecture, how to run and test.
- [x] `docs/ANALYSIS.md`: full analysis, before/after screenshots, integration roadmap.
- [x] `docs/MONO_ALTERNATIVES.md`: provider comparison and recommendation.
- [x] `docs/DEMO_CHECKLIST.md`: settings to change and sandbox test data for the demo.
- [x] `.env.example`: every setting the app reads, explained.
- [x] `supabase/migrations/0005_redesign.sql`: the new migration (safe to re-run).

### A7. Research and advice given
- [x] Mono vs alternatives:
  - **QoreID:** its iGree endpoint returns identity only, and it isn't enabled on your account.
  - **CreditChek:** identity only.
  - **Paystack:** no account lookup.
  - **Interswitch:** lists a "Bank Accounts Lookup" product, but has no public docs.
  - **Adjutor:** a consent-based account lookup.
  - **Prembly:** returns masked numbers.
  - **Dojah:** identity only.
  - **Decision: stay with Mono.**
- [x] NDPC: costs, steps and timeline. A startup must register once it processes 200+ people's data in six months.
- [x] Mono channels found (developer Slack, help centre, support email, status page) and the KYB message drafted.

---

## Part B — What is still to be done

### B1. Before Monday's demo 🔴
| # | Task | Who | How |
|---|---|---|---|
| 1 | Create a **Mono Lookup app** and copy its **test** secret key | 👤 | Mono dashboard → Apps → Create app → Lookup |
| 2 | Put that key in Vercel as `MONO_SEC_KEY` (Production + Preview) | 👤 | Vercel → reclaiming → Settings → Environment Variables |
| 3 | ✅ **Done** — `ADMIN_EMAILS` set (Production + Preview) | 🛠 | — |
| 4 | ✅ **Done** — `LIVENESS_MODE` and `NEXT_PUBLIC_LIVENESS_MODE` = `required` (Production + Preview) | 🛠 | — |
| 5 | ✅ **Done** — migrations 0004 and 0005 applied and verified (columns, settled status, unique payment reference, payments ledger with RLS, 5 raw BVNs masked) | 🛠 | — |
| 6 | Add redirect URLs `https://reclaiming.vercel.app/**` and `https://reclaiming-*-olashs-projects.vercel.app/**`; set the Site URL | 👤 | Supabase → Authentication → URL Configuration |
| 7 | (Optional) turn **off** "Confirm email" so new sign-ups work instantly on stage | 👤 | Supabase → Authentication → Providers → Email |
| 8 | ✅ **Done** — Deployment Protection set to **Standard** (`reclaiming.vercel.app` public; previews still private) | 🛠 | — |
| 9 | Merge the branch into `main` (or promote the preview) and redeploy | 👤 or 🛠 (say the word and I'll do it) | GitHub / Vercel |
| 10 | Set the Paystack **test** webhook URL to `https://reclaiming.vercel.app/api/webhook/paystack` | 👤 | Paystack → Settings → API Keys & Webhooks |
| 11 | Open `/api/diagnostics` on the preview and confirm everything is green | 👤 | browser |
| 12 | **Full dry run**: sign up → NIN (Bunch Dillon / 63184876213) → Paystack test card → **real selfie** → upload → approve in the review queue → Mono search (BVN 12345678901, code 123456) → download the PDF | 👤 | follow `docs/DEMO_CHECKLIST.md` |
| 13 | If the selfie rejects your face against the test NIN, set both liveness settings to `optional` and redeploy | 👤 | Vercel |
| 14 | **Roll** the Paystack test secret key found in git history | 👤 | Paystack → Settings → API Keys |
| 15 | Prepare the pitch: problem, live demo, the regulatory story (iGree consent, provider choice) | 👤 | — |

### B1b. Supabase advisor notes (non-blocking) 🟢
- [ ] Turn on **leaked password protection**: Supabase → Authentication → Policies (security advisor).
- [ ] Set a fixed `search_path` on the `update_updated_at_column` function (security advisor, WARN).
- [ ] Rewrite RLS policies to use `(select auth.uid())` (performance at scale), and index `payments.estate_id`.
- [ ] `bvn_request_logs` has RLS with no policies. That is intended: only the server writes to it.

### B2. Still not proven live (risks to watch in the dry run)
- [ ] Paystack checkout popup with a test card, then server-side verification of that real payment.
- [ ] QoreID selfie with a real camera, and what QoreID's sandbox returns for a face that doesn't match the test NIN.
- [ ] Mono end to end with a Lookup key (initiate → send code → accounts).
- [ ] Google sign-in returning to the new pages on `reclaiming.vercel.app`.
- [ ] Sign-up confirmation and password-reset emails from Supabase landing on the new pages.
- [ ] The review console opening documents from your real storage bucket.
- [ ] The Paystack webhook receiving a real test event.

### B3. Before real users (compliance and business) 🟠
- [ ] 👤 Join Mono's developer Slack and send the KYB message. Get written answers on the operating licence, the deceased-holder consent question, and `alternate_phone`.
- [ ] 👤 Complete Mono KYB and get **live** keys. Then switch Paystack, QoreID and Mono to live keys in Vercel.
- [ ] ⚖️ Register with the **NDPC** at launch: before 200 people's data in any six months. The lowest tier fee is ₦10,000.
- [ ] ⚖️ Designate a **Data Protection Officer**.
- [ ] ⚖️ Do a **DPIA** for the NIN, selfie biometrics, BVN and death-record processing.
- [ ] ⚖️ Have a lawyer rewrite the **Privacy Policy**. It must name QoreID, Mono, Paystack, Supabase, Google and Vercel as processors, and it wrongly says QoreID checks probate documents and claims "AES-256 military-grade" storage.
- [ ] ⚖️ Have a lawyer review the **Terms**, in particular the 10% fee wording (it describes automatic deduction, which the system can't do).
- [ ] ⚖️ Write a data retention policy: how long documents, identity records and logs are kept.
- [ ] ⚖️ Get legal advice on BVN data for **deceased** holders and on a reported January 2026 CBN restriction on fintech BVN use.
- [ ] 👤 Engage a licensed **DPCO** once you're obliged to file the annual audit (first filing within 15 months of operation, then by 31 March each year).
- [ ] 👤 Ask QoreID whether their iGree integration can return linked bank accounts (`banking_data`), as a backup to Mono.
- [ ] 👤 Optional backup providers: an Adjutor sandbox trial; questions to Interswitch about Bank Accounts Lookup.

### B4. Product features still missing 🛠
| Priority | Feature | Why it matters |
|---|---|---|
| 🟠 | **Email / SMS / WhatsApp notifications** when a case is approved, sent back or settled | The UI promises "we will email you"; today nothing sends it |
| 🟠 | **Re-upload documents** after a case is sent back | Today the family is told to message the team |
| 🟠 | **Add Letters of Administration later** to an existing case | Banks need them; families often get them after starting |
| 🟠 | **Collect the 10% success fee** (Paystack invoice or direct-debit mandate) and a signed fee agreement | The main revenue line has no mechanism |
| 🟠 | **Payout account step in the UI** (the `verify-estate-nuban` check exists, but nothing calls it) | Needed when funds are released |
| 🟠 | Self-serve **download my data / delete my account** | NDPA data-subject rights |
| 🟢 | **Dividends discovery**: registrars, CSCS, e-DMMS, the Unclaimed Funds Trust Fund | Half of the PRD's promise |
| 🟢 | **Pensions** (PFAs / PenCom), **group life insurance** (NAICOM), **NDIC** claims for failed banks | Large asset types families miss |
| 🟢 | **Probate support**: lawyer panel per state, "get my Letters of Administration" service | The longest real-world blocker |
| 🟢 | Help for families with **no BVN contact access**: a bank estate-desk partnership | The bank-letter fallback is manual |
| 🟢 | Languages: Yoruba, Igbo, Hausa, Pidgin | Reach and accessibility |

### B5. Engineering follow-ups 🛠
- [ ] 🟠 Confirm selfie results **server-side**, via a QoreID webhook or lookup, instead of trusting the browser's "submitted" event.
- [ ] 🟠 Tie each Mono search session to the user and case on the server (low risk today, but tidier).
- [ ] 🟠 Rate-limit the identity and payment routes too, not just BVN search.
- [ ] 🟠 Record review console decisions in an audit table (today they only go to server logs). Move staff access from `ADMIN_EMAILS` to Supabase roles.
- [ ] 🟠 Error monitoring (Sentry) and product analytics (PostHog or Vercel Analytics) to see where families drop off.
- [ ] 🟢 Run the test suites in GitHub Actions on every push. Add Playwright as a dev dependency (the tests currently use the copy pre-installed in this environment).
- [ ] 🟢 Remove unused packages: `zod`, `@radix-ui/react-tabs`, `@radix-ui/react-select`, `@radix-ui/react-label`.
- [ ] 🟢 Retire the old `/api/generate-qore-session` alias once nothing calls it.
- [ ] 🟢 Optional: OCR on death certificates (set `GCP_SERVICE_ACCOUNT_KEY_BASE64`). It's advisory, and the app works without it.
- [ ] 🟢 Custom domain (e.g. `reclaimng.ng`) for trust and simpler deployment protection.

---

## Quick reference

**Test data (sandbox only):**

| Service | Values |
|---|---|
| QoreID NIN | `63184876213`, name **Bunch Dillon** |
| Mono BVN | BVN `12345678901`, code `123456`, alternate phone `09066662020` |
| Paystack | test card `4084 0840 8408 4081`, CVV `408`, any future expiry |

**Where things are:**

| What | Where |
|---|---|
| Review queue | `/app/admin` (needs `ADMIN_EMAILS`) |
| Live checks | `/api/diagnostics` (previews only) |
| Settings | `.env.example` |
| Demo steps | `docs/DEMO_CHECKLIST.md` |
| Provider options | `docs/MONO_ALTERNATIVES.md` |
