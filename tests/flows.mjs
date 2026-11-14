/**
 * Drives the real UI through every user journey in Chromium, against the app
 * started by tests/serve.sh (all providers mocked). Prints one line per check
 * and exits non-zero if any check fails.
 *
 *   npm run test:serve      # terminal 1
 *   npm run test:flows      # terminal 2   (SHOTS=dir to save screenshots)
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = playwright;

const APP = process.env.APP_URL || 'http://127.0.0.1:3000';
const MOCK = process.env.MOCK_URL || 'http://127.0.0.1:54321';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const admin = (p, body) => fetch(MOCK + '/__admin' + p, { method: 'POST', body: JSON.stringify(body || {}) }).then((r) => r.json());
const state = () => fetch(MOCK + '/__admin/state').then((r) => r.json());

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `\n      ${String(detail).replace(/\n/g, '\n      ')}` : ''}`);
}
const shot = async (page, name, full = true) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });

// Paystack inline stand-in: records the charge with the mock (so the server's
// verification succeeds) and then reports success, like the real popup.
const PAYSTACK_STUB = `
  window.__paid = [];
  window.PaystackPop = function () {
    this.newTransaction = function (o) {
      window.__paid.push({ amount: o.amount, metadata: o.metadata, email: o.email });
      if (window.__paystackMode === 'cancel') return setTimeout(function () { o.onCancel && o.onCancel(); }, 50);
      fetch('${MOCK}/__admin/tx', { method: 'POST', body: JSON.stringify({ reference: o.reference, status: 'success', amount: o.amount, currency: 'NGN', email: o.email, metadata: o.metadata }) })
        .then(function () { o.onSuccess({ reference: o.reference, status: 'success' }); });
    };
  };`;

async function newContext(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...opts });
  await ctx.route('https://js.paystack.co/**', (r) => r.fulfill({ contentType: 'text/javascript', body: PAYSTACK_STUB }));
  return ctx;
}

function watch(page) {
  const log = [];
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && log.push(`console: ${m.text().slice(0, 160)}`));
  return log;
}

const browser = await chromium.launch();
await admin('/reset', { schema: process.env.MOCK_SCHEMA || 'v2' });

try {
  // ── Public pages ──────────────────────────────────────────────────────
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    const log = watch(page);
    const res = await page.goto(APP + '/', { waitUntil: 'networkidle' });
    check('Landing page loads at "/"', res.status() === 200 && (await page.locator('h1').innerText()).includes('Find and recover'));
    await page.keyboard.press('Tab');
    check('First Tab press reveals "Skip to main content"', (await page.evaluate(() => document.activeElement?.textContent)) === 'Skip to main content');
    await shot(page, 'new-01-landing');
    await page.getByRole('button', { name: 'What does it cost, and when do I pay?' }).click();
    check('Landing FAQ opens and shows real pricing', (await page.getByText(/₦5,000 for the identity check/).count()) > 0);
    for (const p of ['/privacy', '/terms']) {
      const r = await page.goto(APP + p, { waitUntil: 'networkidle' });
      check(`${p} loads`, r.status() === 200 && (await page.locator('h1').count()) === 1);
    }
    check('No script errors on public pages', log.length === 0, log.join('\n'));
    await ctx.close();
  }

  // ── Signed-out guard ──────────────────────────────────────────────────
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto(APP + '/app/vault', { waitUntil: 'networkidle' });
    await page.waitForURL(/\/login/);
    check('Signed-out visit to /app/vault goes to log in, remembering where to return', page.url().includes('next=%2Fapp%2Fvault'), page.url());
    await page.goto(APP + '/dashboard.html', { waitUntil: 'networkidle' });
    await page.waitForURL(/\/login/);
    check('Old /dashboard.html link still works (→ /app → log in)', /\/login/.test(page.url()));
    await ctx.close();
  }

  // ── Main journey ─────────────────────────────────────────────────────
  var ctx = await newContext(browser);
  var page = await ctx.newPage();
  const log = watch(page);

  // Sign up
  await page.goto(APP + '/signup', { waitUntil: 'networkidle' });
  await shot(page, 'new-02-signup');
  await page.getByRole('button', { name: 'Create account' }).click();
  const signupErrors = await page.getByRole('main').getByRole('alert').allInnerTexts();
  check('Empty sign-up shows an error under each field', signupErrors.length === 3, signupErrors.join(' | '));
  check('Focus is not lost on error (fields are labelled)', (await page.getByLabel('Your full name').count()) === 1);
  await page.getByLabel('Your full name').fill('Amaka Okonkwo');
  await page.getByLabel('Email address').fill('amaka@example.com');
  await page.getByLabel('Create a password').fill('password123');
  await page.getByRole('button', { name: 'Show password' }).click();
  check('Password can be shown to check it', (await page.getByLabel('Create a password').getAttribute('type')) === 'text');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(APP + '/app');
  await page.getByRole('heading', { name: 'Welcome, Amaka' }).waitFor();
  check('Sign-up lands on a personalised home', true);
  await shot(page, 'new-03-home-empty');
  check('Empty home tells the person what to have ready and offers one clear action', (await page.getByRole('link', { name: /Start a recovery/ }).count()) >= 1 && (await page.getByText('Have these ready').count()) === 1);

  // Wizard intro
  await page.getByRole('main').getByRole('link', { name: /Start a recovery/ }).click();
  await page.getByRole('heading', { name: 'Before you begin' }).waitFor();
  await shot(page, 'new-04-wizard-intro');
  check('Wizard explains time, documents and both fees before anything else', (await page.getByText(/₦5,000 to confirm your identity and ₦75,000/).count()) === 1);
  await page.getByRole('button', { name: 'Begin' }).click();

  // Step 1
  check('Step 1 is prefilled with the name from sign-up', (await page.getByLabel('First name').inputValue()) === 'Amaka');
  await page.getByRole('button', { name: 'Continue' }).click();
  const s1Errors = await page.getByRole('main').getByRole('alert').allInnerTexts();
  check('Step 1 validates phone, date of birth and NIN in plain language', s1Errors.length === 3, s1Errors.join(' | '));
  check('Focus moves to the first field with a problem', await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid') === 'true'));
  await page.getByLabel('Mobile number').fill('0801 234 5678');
  await page.getByLabel('Date of birth').fill('1988-04-12');
  await page.getByLabel(/National Identification Number/).fill('1111 1111 111 99');
  check('A NIN pasted with spaces is cleaned to 11 digits', (await page.getByLabel(/National Identification Number/).inputValue()) === '11111111111');
  await shot(page, 'new-05-wizard-step1');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2
  await page.getByRole('heading', { name: 'About your loved one' }).waitFor();
  check('Moving to a step puts keyboard focus on its heading', await page.evaluate(() => document.activeElement?.tagName === 'H2'));
  await page.getByLabel('Their full legal name').fill('Samuel Adekunle Bello');
  await page.getByLabel('Date they passed away').fill('2031-01-01');
  await page.getByLabel('How are you related to them?').selectOption('Child');
  await page.getByRole('button', { name: 'Continue' }).click();
  check('A date of death in the future is caught', (await page.getByText('This date is in the future').count()) === 1);
  await page.getByLabel('Date they passed away').fill('2025-01-10');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Refresh mid-way: answers survive
  await page.getByRole('heading', { name: 'Confirm your identity' }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Confirm your identity' }).waitFor();
  check('Refreshing mid-wizard keeps the step and every answer', (await page.getByText('Amaka Okonkwo').count()) >= 1 && (await page.getByText('Step 3 of 5').count()) === 1);

  // Step 3 — pay + verify
  await shot(page, 'new-06-wizard-identity');
  await page.evaluate(() => (window.__paystackMode = 'cancel'));
  await page.getByRole('button', { name: /Pay ₦5,000 and confirm/ }).click();
  await page.getByText('Payment was not completed').waitFor();
  check('Closing the payment window explains what happened and changes nothing', (await page.getByText('Step 3 of 5').count()) === 1);
  await page.evaluate(() => (window.__paystackMode = 'success'));
  await page.getByRole('button', { name: /Pay ₦5,000 and confirm/ }).click();
  await page.getByRole('heading', { name: 'Add the documents' }).waitFor({ timeout: 15000 });
  const paid = await page.evaluate(() => window.__paid);
  check('Identity fee charged once, for exactly ₦5,000, tagged with the user', paid.length === 2 && paid[1].amount === 500000 && paid[1].metadata?.purpose === 'identity', JSON.stringify(paid));

  // Step 4 — documents
  await page.getByRole('button', { name: 'Continue' }).click();
  check('Cannot continue without the death certificate', (await page.getByText('Please attach the death certificate to continue.').count()) === 1);
  const inputs = page.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles({ name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('MZ') });
  check('A wrong file type is refused with a clear message', (await page.getByText('That file type is not supported').count()) === 1);
  await inputs.nth(0).setInputFiles({ name: 'death-certificate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 certificate of death Samuel Adekunle Bello') });
  check('A chosen file is shown with its name and a Remove button', (await page.getByText('death-certificate.pdf').count()) === 1 && (await page.getByRole('button', { name: /Remove/ }).count()) === 1);
  await shot(page, 'new-07-wizard-documents');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 5 — review + consent + pay
  await page.getByRole('heading', { name: 'Review and send' }).waitFor();
  await shot(page, 'new-08-wizard-review');
  await page.getByRole('button', { name: /Pay ₦75,000 and send/ }).click();
  check('Consent is required and the reason is announced', (await page.getByText('Please tick the box to confirm').count()) === 1);
  await page.locator('#consent').click();
  await page.getByRole('button', { name: /Pay ₦75,000 and send/ }).click();
  await page.getByRole('heading', { name: 'We have received your documents' }).waitFor({ timeout: 20000 });
  await shot(page, 'new-09-wizard-done');
  let s = await state();
  const estate = s.tables.estates.find((e) => e.deceased_name === 'Samuel Adekunle Bello');
  check('Submission opens one paid case in review', s.tables.estates.length === 1 && estate?.payment_status === 'paid' && estate?.status === 'pending_review');
  check('Confirmation says what happens next', (await page.getByText('What happens next').count()) === 1);
  check('Saved answers are cleared once the case is open', await page.evaluate(() => !Object.keys(sessionStorage).some((k) => k.startsWith('reclaimng:draft'))));

  // Case in review
  await page.getByRole('link', { name: 'View your case' }).click();
  await page.getByText('We are reviewing your documents').waitFor();
  await shot(page, 'new-10-case-review');
  check('Case page says plainly there is nothing to do while in review', (await page.getByText('There is nothing you need to do right now').count()) === 1);
  await page.goto(APP + '/app', { waitUntil: 'networkidle' });
  await page.getByText('In review').first().waitFor();
  await shot(page, 'new-11-home-with-case');
  await page.getByRole('button', { name: /Completed/ }).click();
  check('Home filters actually filter', (await page.getByText('No completed recoveries yet').count()) === 1);

  // Team approves → search for accounts straight away
  await admin('/patch', { table: 'estates', id: estate.id, patch: { status: 'verified' } });
  await page.goto(APP + `/app/estates/${estate.id}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Find every linked account' }).waitFor();
  check('Once approved, the case goes straight to the account search', (await page.getByText('Your documents are approved').count()) === 1);

  // Fallback: the bank letter is still available, but no longer a gate
  await page.getByRole('button', { name: /None of these contacts reach anyone/ }).click();
  await page.getByRole('heading', { name: 'Prepare a letter for the bank' }).waitFor();
  check('Bank letter is offered as a fallback and prefilled with the verified name', (await page.getByLabel('Your full name').inputValue()) === 'Amaka Okonkwo');
  await page.getByLabel('Bank name').fill('GTBank');
  await page.getByLabel('Branch address').fill('12 Allen Avenue, Ikeja, Lagos');
  await page.getByRole('group', { name: 'Letter preview' }).waitFor();
  const letterBvn = page.getByLabel('Their BVN').nth(1);
  await letterBvn.fill('12345678901');
  await page.getByLabel('Your mobile number').fill('08012345678');
  check('Letter preview updates as you type', (await page.getByRole('group', { name: 'Letter preview' }).innerText()).includes('12345678901'));
  await shot(page, 'new-12-bank-letter');
  const [letter] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download letter/ }).click()]);
  const letterBytes = fs.readFileSync(await letter.path());
  check('Bank letter downloads as a real PDF', letterBytes.subarray(0, 5).toString() === '%PDF-', letter.suggestedFilename());
  await page.getByText('When the bank confirms the change').waitFor();

  // Search: BVN → choose where the code goes → code
  await page.getByLabel('Their BVN').first().fill('12345678901');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Send the code to').waitFor();
  check('The family chooses where the code goes, with masked hints from NIBSS', (await page.getByText('0803***5678').count()) === 1 && (await page.getByRole('radio').count()) === 3);
  await page.getByRole('button', { name: 'Send the code' }).click();
  check('Sending without choosing a contact is explained', (await page.getByText('Choose where the code should be sent.').count()) === 1);
  await page.getByRole('radio', { name: 'Text message to another phone number' }).check();
  await page.getByLabel('Phone number to receive the code').fill('0906 666 2020');
  await shot(page, 'new-12b-choose-channel');
  await page.getByRole('button', { name: 'Send the code' }).click();
  await page.getByText('09066662020').waitFor();
  check('Code screen says where the code went', true);
  await page.getByLabel('One-time code').fill('000000');
  await page.getByRole('button', { name: 'Find accounts' }).click();
  await page.getByText('That code was not accepted').waitFor();
  check('A wrong code is explained and can be retried', true);
  await page.getByLabel('One-time code').fill('123456');
  await page.getByRole('button', { name: 'Find accounts' }).click();
  await page.getByRole('heading', { name: 'Accounts found (3)' }).waitFor({ timeout: 15000 });
  await shot(page, 'new-13-accounts-found');
  check('Found accounts are listed by bank with full account numbers', (await page.getByText('0123456789').count()) === 1 && (await page.getByText('Access Bank').count()) === 1);
  const [schedule] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download list/ }).click()]);
  check('Schedule of assets downloads as a PDF', fs.readFileSync(await schedule.path()).subarray(0, 5).toString() === '%PDF-', schedule.suggestedFilename());

  // Vault
  await page.goto(APP + '/app/vault', { waitUntil: 'networkidle' });
  await page.getByText('Nothing has been released yet').waitFor();
  check('Recovered funds page has a helpful empty state', true);
  await admin('/patch', { table: 'estates', id: estate.id, patch: { status: 'settled', total_asset_value: 11205000 } });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('₦11,205,000').first().waitFor();
  await shot(page, 'new-14-vault');
  check('Settled case and its amount appear under Recovered funds', true);

  // Mobile
  {
    const m = await newContext(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await m.addCookies([]);
    const mp = await m.newPage();
    await mp.goto(APP + '/login', { waitUntil: 'networkidle' });
    await mp.getByLabel('Email address').fill('amaka@example.com');
    await mp.getByLabel('Password', { exact: true }).fill('password123');
    await mp.getByRole('button', { name: 'Log in' }).click();
    await mp.waitForURL(APP + '/app');
    for (const [name, url] of [['home', '/app'], ['case', `/app/estates/${estate.id}`], ['new', '/app/new'], ['landing', '/']]) {
      await mp.goto(APP + url, { waitUntil: 'networkidle' });
      await mp.waitForTimeout(400);
      const { sw, cw } = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      check(`Mobile (390px) ${name}: no sideways scrolling`, sw <= cw, `${sw} > ${cw}`);
      await shot(mp, `new-m-${name}`, false);
    }
    await mp.goto(APP + '/app', { waitUntil: 'networkidle' });
    await mp.getByRole('button', { name: 'Open menu' }).click();
    await mp.getByRole('dialog').getByRole('link', { name: 'Recovered funds' }).click();
    await mp.waitForURL(/\/app\/vault/);
    check('Mobile menu opens and navigates', true);
    await m.close();
  }

  // Log out / log in / reset / Google return
  await page.goto(APP + '/app', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Amaka Okonkwo/ }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/);
  check('Log out returns to the log-in page', true);
  await page.goto(APP + '/app', { waitUntil: 'networkidle' });
  await page.waitForURL(/\/login/);
  check('After logging out, the app is no longer reachable', true);
  await page.getByLabel('Email address').fill('amaka@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByText('That email and password do not match').waitFor();
  check('Wrong password gives a clear, specific message', true);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(APP + '/app');
  check('Log in with the right password returns to the cases', true);

  await page.getByRole('button', { name: /Amaka Okonkwo/ }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email address').fill('amaka@example.com');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await page.getByRole('heading', { name: 'Forgot your password?' }).waitFor();
  check('Forgot password keeps the email already typed', (await page.getByLabel('Email address').inputValue()) === 'amaka@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await page.getByRole('heading', { name: 'Check your email' }).waitFor();
  check('Forgot password confirms the email was sent', true);
  const reset = await admin('/user', { email: 'reset@example.com' });
  await page.goto(`${APP}/reset-password#access_token=${reset.session.access_token}&refresh_token=${reset.session.refresh_token}&expires_in=3600&expires_at=${reset.session.expires_at}&token_type=bearer&type=recovery`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Choose a new password' }).waitFor();
  await page.getByLabel('New password').fill('brand-new-pass');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await page.waitForURL(APP + '/app');
  check('The emailed reset link opens a form that actually sets a new password', true);

  const g = await ctx.newPage();
  await g.evaluate(() => 0);
  await ctx.clearCookies();
  await page.evaluate(() => localStorage.clear());
  const google = await admin('/user', { email: 'google-user@example.com', user_metadata: { full_name: 'Tunde Bello' } });
  await page.goto(`${APP}/dashboard.html#access_token=${google.session.access_token}&refresh_token=${google.session.refresh_token}&expires_in=3600&expires_at=${google.session.expires_at}&token_type=bearer`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Welcome, Tunde' }).waitFor({ timeout: 10000 });
  check('Returning from Google (even via the old /dashboard.html address) signs the person in', true);

  check('No script errors during the whole journey', log.length === 0, log.join('\n'));
  await ctx.close();
} catch (err) {
  check('Journey completed without getting stuck', false, `${err.message.split('\n')[0]}\n  at ${typeof page !== 'undefined' ? page.url() : '?'}`);
  if (SHOTS && typeof page !== 'undefined') await page.screenshot({ path: path.join(SHOTS, 'stuck.png') }).catch(() => {});
}

await browser.close();
fs.writeFileSync(path.join(SHOTS || '.', 'flows-result.json'), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
