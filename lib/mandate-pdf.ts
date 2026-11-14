import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import { mandateParagraphs, type MandateLetter } from './mandate-text';

const winAnsi = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ]/g, '?');

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Builds the bank letter as a real text PDF (selectable, searchable, sharp
 * when printed) in the browser — no screenshotting of the page.
 */
export async function buildMandatePdf(letter: MandateLetter): Promise<Blob> {
  const p = mandateParagraphs(letter);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Bank letter - Estate of ${winAnsi(letter.deceasedName)}`);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const page = pdf.addPage([595.28, 841.89]);
  const margin = 72;
  const width = page.getWidth() - margin * 2;
  const size = 12;
  const lead = 17;
  let y = page.getHeight() - margin;

  const text = (s: string, f = font, gap = lead) => {
    for (const line of wrap(winAnsi(s), f, size, width)) {
      page.drawText(line, { x: margin, y, size, font: f });
      y -= lead;
    }
    y -= gap - lead;
  };

  const dateWidth = font.widthOfTextAtSize(p.date, size);
  page.drawText(p.date, { x: page.getWidth() - margin - dateWidth, y, size, font });
  y -= lead * 2;
  p.addressee.forEach((l, i) => text(l, i === 1 ? bold : font));
  y -= lead;
  text(p.salutation, font, lead * 1.6);
  text(p.subject, bold, lead * 1.6);
  p.body.forEach((para) => text(para, font, lead * 1.6));
  p.attachments.forEach((a, i) => text(`${i + 1}.  ${a}`));
  y -= lead;
  text(p.closing, font, lead * 3.5);
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: margin + 200, y: y + 6 }, thickness: 0.8 });
  y -= 8;
  text(p.signature[0], bold);
  text(p.signature[1]);

  const bytes = await pdf.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
