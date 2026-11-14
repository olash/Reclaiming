# Reclaimng

Helps Nigerian families trace and recover the bank accounts (and, in future, the
unclaimed dividends) of a relative who has passed away.

A full write-up of what was found, what changed and what to integrate next is in
[`docs/ANALYSIS.md`](docs/ANALYSIS.md).

## How it is built

| Part | Where | Notes |
| --- | --- | --- |
| Pages | `app/` (Next.js 14 App Router) | Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`. Signed in: `/app`, `/app/new`, `/app/estates/[id]`, `/app/vault`. |
| UI kit | `components/ui/` | Tailwind + Radix primitives in the shadcn/ui style. Design tokens in `app/globals.css` and `tailwind.config.ts`. |
| API | `app/api/*/route.ts` | Every route except `config` and the Paystack webhook needs a signed-in user (`Authorization: Bearer <supabase access token>`). |
| Server helpers | `lib/server/` | Auth, ownership checks, Paystack verification, name matching, Mono, document check. |
| Fees | `lib/fees.ts` | The single place prices live; UI, checkout and server checks all read it. |
| Database | `supabase/migrations/` | Run in order in the Supabase SQL editor. `0005` is new; the app degrades gracefully if it has not been run. |

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

- `npm run test:api` — 77 end-to-end tests of every API route (auth, payments, ownership, edge cases).
- `npm run test:api:unmigrated` — the same against the database as it is before migration `0005`.
- `npm run test:flows` — 56 checks driving the real UI in Chromium through every journey.
- `npm run test:a11y` — axe-core WCAG 2.2 AA scan of every page at desktop and phone widths.
