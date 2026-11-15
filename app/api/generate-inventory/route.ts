import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import { HttpError, assertUuid, readJson, route } from '@/lib/server/http';
import { normaliseAccount } from '@/lib/server/mono';
import { adminClient, requireOwnEstate, requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

const MARGIN = 50;
const ROW = 24;
const COLS = { sn: MARGIN, bank: MARGIN + 34, number: MARGIN + 200, type: MARGIN + 300, value: MARGIN + 380 };

/** The standard PDF fonts cannot draw every character (₦ is one). Replace anything unsafe. */
function safe(text: string, max = 200) {
  const cleaned = String(text ?? '')
    .replace(/₦/g, 'NGN ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E -ÿ]/g, '?');
  return cleaned.length > max ? cleaned.slice(0, max - 3) + '...' : cleaned;
}

function centred(page: PDFPage, text: string, y: number, size: number, font: PDFFont) {
  page.drawText(text, { x: (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2, y, size, font });
}

/**
 * POST /api/generate-inventory        (signed-in owner of the case only)
 * Body: { estate_id }
 *
 * Builds a "Schedule of Assets" PDF for the caller's own case from the
 * accounts stored on that case. Everything on the page comes from our
 * records — the request cannot supply names, assets or amounts — and the
 * document says plainly that it is a working schedule, not a court order.
 */
export const POST = route('generate-inventory', async (request) => {
  const user = await requireUser(request);
  const body = await readJson<{ estate_id?: string; estateId?: string }>(request);
  const estate = await requireOwnEstate(user.id, assertUuid(body.estate_id ?? body.estateId, 'case id'));

  const accounts = (Array.isArray(estate.discovered_accounts) ? estate.discovered_accounts : []).map(normaliseAccount);
  if (!accounts.length) throw new HttpError(409, 'There are no accounts on this case yet. Run account discovery first.', 'NO_ACCOUNTS');

  const { data: kyc } = await adminClient().from('verifications').select('profile_data').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1);
  const applicant = kyc?.[0]?.profile_data?.applicant;
  const administrator = applicant?.firstname ? `${applicant.firstname} ${applicant.lastname ?? ''}`.trim() : (user.user_metadata?.full_name as string) || user.email || 'Administrator';

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Schedule of Assets - Estate of ${safe(estate.deceased_name)}`);
  pdf.setCreator('Reclaiming');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const ref = 'REQ-' + estate.id.replace(/-/g, '').slice(0, 6).toUpperCase();

  let page!: PDFPage;
  let y = 0;
  let pageNo = 0;

  const tableHeader = () => {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: page.getWidth() - MARGIN, y }, thickness: 1 });
    y -= 16;
    page.drawText('No.', { x: COLS.sn, y, size: 9, font: bold });
    page.drawText('Bank', { x: COLS.bank, y, size: 9, font: bold });
    page.drawText('Account number', { x: COLS.number, y, size: 9, font: bold });
    page.drawText('Type', { x: COLS.type, y, size: 9, font: bold });
    page.drawText('Balance', { x: COLS.value, y, size: 9, font: bold });
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: page.getWidth() - MARGIN, y }, thickness: 0.5 });
    y -= ROW - 6;
  };

  const newPage = () => {
    page = pdf.addPage(PageSizes.A4);
    pageNo += 1;
    y = page.getHeight() - 64;
    if (pageNo === 1) {
      centred(page, 'SCHEDULE OF ASSETS', y, 15, bold);
      y -= 22;
      centred(page, safe(`ESTATE OF ${estate.deceased_name.toUpperCase()} (DECEASED)`, 70), y, 12, bold);
      y -= 30;
      const intro = `Bank accounts identified for the estate through a consented BVN search on Reclaiming. Prepared by ${safe(administrator, 60)} on ${today}. Case reference ${ref}.`;
      page.drawText(intro, { x: MARGIN, y, size: 10, font, maxWidth: page.getWidth() - MARGIN * 2, lineHeight: 14, color: rgb(0.15, 0.15, 0.15) });
      y -= 48;
    } else {
      page.drawText(safe(`Schedule of Assets - Estate of ${estate.deceased_name} (continued)`, 90), { x: MARGIN, y, size: 10, font: bold });
      y -= 24;
    }
    tableHeader();
  };

  newPage();
  accounts.forEach((account, i) => {
    if (y < 110) newPage();
    if (i % 2 === 0) page.drawRectangle({ x: MARGIN, y: y - 7, width: page.getWidth() - MARGIN * 2, height: ROW, color: rgb(0.96, 0.97, 0.96) });
    page.drawText(String(i + 1), { x: COLS.sn, y, size: 9, font });
    page.drawText(safe(account.bank_name, 30), { x: COLS.bank, y, size: 9, font });
    page.drawText(safe(account.account_number, 14), { x: COLS.number, y, size: 9, font });
    page.drawText(safe(account.account_type ?? '-', 14), { x: COLS.type, y, size: 9, font });
    page.drawText('To be confirmed by bank', { x: COLS.value, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
    y -= ROW;
  });

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 62 }, end: { x: p.getWidth() - MARGIN, y: 62 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
    p.drawText('Working schedule prepared by the administrator. This is not a court order or a grant of probate. Balances are', { x: MARGIN, y: 48, size: 7.5, font, color: rgb(0.35, 0.35, 0.35) });
    p.drawText('released by each bank only on presentation of Letters of Administration or Probate.', { x: MARGIN, y: 38, size: 7.5, font, color: rgb(0.35, 0.35, 0.35) });
    p.drawText(`Reclaiming - ${ref} - Page ${i + 1} of ${pages.length}`, { x: MARGIN, y: 24, size: 7.5, font, color: rgb(0.35, 0.35, 0.35) });
  });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Schedule_of_Assets_${ref}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});
