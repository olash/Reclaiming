/**
 * WCAG 2.2 AA scan (axe-core) of every page, signed out and signed in, at
 * desktop and phone widths. Run against tests/serve.sh: `npm run test:a11y`.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node-tools/node_modules/playwright'); }
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const APP = process.env.APP_URL || 'http://127.0.0.1:3000';
const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:54321';
const admin = (p, body) => fetch(MOCK + '/__admin' + p, { method: 'POST', body: JSON.stringify(body || {}) }).then((r) => r.json());

const u = await admin('/user', { email: 'family.a11y@example.com', user_metadata: { full_name: 'Amaka Okonkwo' } });
const reviewer = await admin('/user', { email: 'reviewer@reclaimng.test', user_metadata: { full_name: 'Review Team' } });
const ids = {};
for (const [key, patch] of Object.entries({
  review: { status: 'pending_review' },
  letter: { status: 'verified', mandate_acknowledged: false },
  find: { status: 'verified', mandate_acknowledged: true },
  found: { status: 'verified', mandate_acknowledged: true, discovered_accounts: [{ bank_name: 'GTBank', bank_code: '058', account_number: '0123456789', account_name: 'SAMUEL BELLO', account_type: 'SAVINGS' }] },
  rejected: { status: 'rejected', review_note: 'The death certificate photo is too blurry to read.' },
})) {
  ids[key] = crypto.randomUUID();
  await admin('/row', { table: 'estates', row: { id: ids[key], user_id: u.user.id, estate_name: 'Estate of Samuel Bello', deceased_name: 'Samuel Bello', payment_status: 'paid', paystack_reference: 'a11y_' + ids[key], death_certificate_path: 'x', letter_of_administration_path: null, discovered_accounts: [], mandate_acknowledged: false, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch } });
}

const publicPages = ['/', '/login', '/signup', '/forgot-password', '/privacy', '/terms', '/brand', '/admin/login', '/this-page-does-not-exist'];
const appPages = ['/app', '/app/new', '/app/vault', '/admin', ...Object.values(ids).map((id) => `/app/estates/${id}`)];
const adminPages = ['/admin'];

const browser = await playwright.chromium.launch();
let total = 0;
for (const [label, viewport] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  for (const p of [...publicPages, '__login__', ...appPages, '__admin__', ...adminPages]) {
    if (p === '__login__') {
      await page.goto(APP + '/login', { waitUntil: 'networkidle' });
      await page.getByLabel('Email address').fill(u.user.email);
      await page.getByLabel('Password', { exact: true }).fill('password123');
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.waitForURL(APP + '/app');
      continue;
    }
    if (p === '__admin__') {
      await page.evaluate(() => localStorage.clear()); // sign the family account out
      await page.goto(APP + '/admin/login', { waitUntil: 'networkidle' });
      await page.getByLabel('Email address').fill(reviewer.user.email);
      await page.getByLabel('Password', { exact: true }).fill('password123');
      await page.getByRole('button', { name: 'Log in to the console' }).click();
      await page.waitForURL(APP + '/admin');
      continue;
    }
    await page.goto(APP + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    if (p === '/app/new') await page.getByRole('button', { name: 'Begin' }).click().then(() => page.getByRole('button', { name: 'Continue' }).click());
    await page.evaluate(axeSource);
    const r = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }));
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const issues = r.violations.map((v) => `[${v.impact}] ${v.id} ×${v.nodes.length}: ${v.help} — ${v.nodes[0]?.target}`);
    if (sw > cw) issues.push(`horizontal scroll: page is ${sw}px wide in a ${cw}px viewport`);
    total += issues.length;
    console.log(`${issues.length ? 'FAIL' : 'PASS'}  ${label.padEnd(7)} ${p}${issues.length ? '\n      ' + issues.join('\n      ') : ''}`);
  }
  await ctx.close();
}
await browser.close();
console.log(total ? `\n${total} issue(s)` : '\nNo accessibility violations found');
process.exit(total ? 1 : 0);
