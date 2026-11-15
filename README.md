# Reclaimng

Helps Nigerian families trace and recover the bank accounts (and, in future, the
unclaimed dividends) of a relative who has passed away.

- **Where things stand:** [`docs/STATUS_CHECKLIST.md`](docs/STATUS_CHECKLIST.md): everything done and everything still to do.
- **Presenting?** Start with [`docs/DEMO_CHECKLIST.md`](docs/DEMO_CHECKLIST.md) (settings) and [`docs/TEST_DATA.md`](docs/TEST_DATA.md) (every test value, for every flow).
- **Analysis** of what was found, what changed and what to integrate next: [`docs/ANALYSIS.md`](docs/ANALYSIS.md).
- **Mono alternatives** for account discovery: [`docs/MONO_ALTERNATIVES.md`](docs/MONO_ALTERNATIVES.md).
- **Brand guidelines** (logo, colour, type, pattern, voice): [`docs/BRAND.md`](docs/BRAND.md), and live at `/brand`.

## The journey

1. **Identity.** The family member's NIN is matched with QoreID NIN Premium (₦5,000). Then a QoreID **selfie liveness** check (`liveness_nin`, Web SDK) confirms it is really them.
2. **Documents.** The death certificate (and Letters of Administration, if available) is uploaded after the ₦75,000 fee, which is verified with Paystack on the server.
3. **Review.** The admin (`ADMIN_EMAILS`) logs in at `/admin/login` and approves or sends back cases in the review console at `/admin`. Access is role-based: families never see it, and the admin only sees the console.
4. **Account search.** A consented NIBSS iGree BVN search through **Mono Lookup (v3)**. The family chooses where the one-time code goes (email, the BVN's phones, or another phone), and every linked account is listed. A bank letter is offered as a fallback.
5. **Claim.** A downloadable schedule of assets, then claims with each bank. Cases are marked settled with the amount released.

## How it is built

| Part | Where | Notes |
| --- | --- | --- |
| Pages | `app/` (Next.js 14 App Router) | Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/brand`. Families: `/app`, `/app/new`, `/app/estates/[id]`, `/app/vault`. Admin: `/admin/login`, `/admin`. |
| UI kit | `components/ui/`, `components/brand/` | Tailwind + Radix primitives in the shadcn/ui style, themed with the adire palette. Tokens in `app/globals.css` and `tailwind.config.ts`; logo in `components/logo.tsx`; hand-drawn motifs in `components/brand/motifs.tsx`. |
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
