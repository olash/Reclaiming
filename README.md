# Reclaimng

Helps Nigerian families trace and recover the bank accounts (and, in future, the
unclaimed dividends) of a relative who has passed away.

- **Presenting?** Start with [`docs/DEMO_CHECKLIST.md`](docs/DEMO_CHECKLIST.md): the settings to change and the sandbox test data.
- **Analysis** of what was found, what changed and what to integrate next: [`docs/ANALYSIS.md`](docs/ANALYSIS.md).
- **Mono alternatives** for account discovery: [`docs/MONO_ALTERNATIVES.md`](docs/MONO_ALTERNATIVES.md).

## The journey

1. **Identity.** The family member's NIN is matched with QoreID NIN Premium (₦5,000). Then a QoreID **selfie liveness** check (`liveness_nin`, Web SDK) confirms it is really them.
2. **Documents.** The death certificate (and Letters of Administration, if available) is uploaded after the ₦75,000 fee, which is verified with Paystack on the server.
3. **Review.** Staff (`ADMIN_EMAILS`) approve or send back cases in the **Review queue** at `/app/admin`.
4. **Account search.** A consented NIBSS iGree BVN search through **Mono Lookup (v3)**. The family chooses where the one-time code goes (email, the BVN's phones, or another phone), and every linked account is listed. A bank letter is offered as a fallback.
5. **Claim.** A downloadable schedule of assets, then claims with each bank. Cases are marked settled with the amount released.

## How it is built

| Part | Where | Notes |
| --- | --- | --- |
| Pages | `app/` (Next.js 14 App Router) | Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`. Signed in: `/app`, `/app/new`, `/app/estates/[id]`, `/app/vault`. |
| UI kit | `components/ui/` | Tailwind + Radix primitives in the shadcn/ui style. Design tokens in `app/globals.css` and `tailwind.config.ts`. |
| API | `app/api/*/route.ts` | Every route except `config` and the Paystack webhook needs a signed-in user (`Authorization: Bearer <supabase access token>`). |
| Server helpers | `lib/server/` | Auth, ownership checks, Paystack verification, name matching, Mono, document check. |
| Fees | `lib/fees.ts` | The single place prices live; UI, checkout and server checks all read it. |
| Database | `supabase/migrations/` | Run in order in the Supabase SQL editor. `0005` is new; the app degrades gracefully if it has not been run. |
| Providers | `lib/server/qoreid.ts`, `lib/server/mono.ts`, `lib/server/bvn-discovery.ts`, `lib/server/paystack.ts` | Account discovery sits behind a provider interface (`BVN_PROVIDER`). |
| Live check | `GET /api/diagnostics` | Runs live checks of Supabase, Paystack, QoreID and Mono on preview deployments (disabled on production). |

Old `*.html` addresses redirect to their replacements (see `next.config.js`),
so bookmarked links, emailed links and OAuth return addresses keep working.

## Run it locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

In Supabase → Authentication → URL Configuration, add your site URL and these
redirect URLs: `/app` and `/reset-password` (for every domain you deploy to).

## Tests

All tests run against **local mocks** of Supabase, Paystack, QoreID and Mono
(`tests/mock/`) — no real keys, money or identity data.

```bash
npm run test:serve          # terminal 1: builds the app and starts it with the mocks
```

```bash
npm test                    # terminal 2: API tests + browser journeys + accessibility scan
```

- `npm run test:api` — 88 end-to-end tests of every API route (auth, payments, ownership, liveness, account search, review console).
- `npm run test:api:unmigrated` / `npm run test:api:live-schema` — the same against older database states, including the one the live project is in today.
- `npm run test:flows` — 64 checks driving the real UI in Chromium through every journey, including a reviewer approving a case.
- `npm run test:a11y` — axe-core WCAG 2.2 AA scan of every page at desktop and phone widths.
