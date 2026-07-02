/**
 * @file app/api/generate-inventory/route.ts
 * @description Serverless-friendly API route for generating a formal legal estate inventory PDF.
 *
 * STRATEGY: Uses `pdf-lib` exclusively — a pure-JS, buffer-based library. This deliberately
 * avoids Puppeteer / wkhtmltopdf (which require costly headless Chrome containers) so the
 * route runs on Vercel's free Edge/Serverless tier with near-zero compute cost.
 *
 * COORDINATE SYSTEM: pdf-lib uses an absolute (X, Y) system where (0, 0) is the BOTTOM-LEFT
 * corner of the page. Y values therefore count upward from the bottom. All layout positions
 * below are expressed as offsets from the top (height - offset) for readability.
 */

import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

interface AssetRow {
  /** Short label, e.g. "Savings Account", "Ordinary Shares" */
  description: string;
  /** Holding institution or registrar, e.g. "GTBank", "Africa Prudential" */
  institution: string;
  /** Numeric or string value, e.g. 250000 or "Unknown" */
  value: string | number;
}

interface InventoryPayload {
  /** Full legal name of the deceased exactly as it should appear on the document */
  deceasedName: string;
  /** Name of the court-appointed administrator (verified via NIMC) */
  administratorName: string;
  /** Ordered list of estate assets to render in the table */
  assets: AssetRow[];
}

// ---------------------------------------------------------------------------
// Constants — Layout (all Y-values expressed as offsets FROM THE TOP)
// ---------------------------------------------------------------------------

const PAGE_MARGIN      = 50;   // pts — left/right margin
const HEADER_OFFSET    = 60;   // pts from top → first header line
const DECL_OFFSET      = 165;  // pts from top → declaration block
const TABLE_TOP_OFFSET = 210;  // pts from top → top rule of the table
const ROW_HEIGHT       = 22;   // pts per data row
const FOOTER_HEIGHT    = 110;  // pts from bottom → footer starts
const FONT_SIZE_HEADER = 11;
const FONT_SIZE_BODY   = 9;
const FONT_SIZE_FOOTER = 8;

// Column X baselines
const COL_SN          = 50;
const COL_DESC        = 80;
const COL_INSTITUTION = 300;
const COL_VALUE       = 460;

// ---------------------------------------------------------------------------
// Helper: safe text truncation to prevent overflow
// ---------------------------------------------------------------------------

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text;
}

// ---------------------------------------------------------------------------
// Helper: horizontally center a string on the page
// ---------------------------------------------------------------------------

function centerX(
  text: string,
  pageWidth: number,
  fontSize: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
): number {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  return (pageWidth - textWidth) / 2;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    // -----------------------------------------------------------------------
    // 1. Parse & Validate Payload
    // -----------------------------------------------------------------------
    let body: InventoryPayload;

    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { deceasedName, administratorName, assets } = body;

    if (!deceasedName?.trim() || !administratorName?.trim()) {
      return new Response(
        JSON.stringify({ error: '`deceasedName` and `administratorName` are required fields.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(assets) || assets.length === 0) {
      return new Response(
        JSON.stringify({ error: '`assets` must be a non-empty array.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Initialise PDF Document — Standard A4 (595.28 × 841.89 pts)
    // -----------------------------------------------------------------------
    const pdfDoc    = await PDFDocument.create();
    const font      = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont  = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page              = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const contentWidth      = width - PAGE_MARGIN * 2;

    // Shorthand: convert a "from-top" offset to pdf-lib's bottom-origin Y
    const fromTop = (offsetFromTop: number) => height - offsetFromTop;

    // -----------------------------------------------------------------------
    // 3. Legal Header (centered, bold) — Y ≈ 780 from bottom
    // -----------------------------------------------------------------------
    const line1 = 'IN THE HIGH COURT OF NIGERIA';
    const line2 = 'IN THE PROBATE REGISTRY';
    const line3 = `IN THE ESTATE OF ${deceasedName.toUpperCase()}, DECEASED`;

    const headerLines = [line1, line2, line3];
    let headerY = fromTop(HEADER_OFFSET);

    for (const line of headerLines) {
      page.drawText(line, {
        x:    centerX(line, width, FONT_SIZE_HEADER, boldFont),
        y:    headerY,
        size: FONT_SIZE_HEADER,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      headerY -= 18; // line spacing
    }

    // Decorative rule beneath header
    page.drawLine({
      start:     { x: PAGE_MARGIN + 40, y: headerY - 6 },
      end:       { x: width - PAGE_MARGIN - 40, y: headerY - 6 },
      thickness: 0.5,
      color:     rgb(0.3, 0.3, 0.3),
    });

    // -----------------------------------------------------------------------
    // 4. Declaration Block — Y ≈ 650 from bottom
    // -----------------------------------------------------------------------
    const declaration =
      'A true and complete inventory of all the personal estate and effects of the ' +
      'said deceased discovered via the Reclaimng Transition Protocol.';

    page.drawText(declaration, {
      x:        PAGE_MARGIN,
      y:        fromTop(DECL_OFFSET),
      size:     FONT_SIZE_BODY,
      font:     font,
      maxWidth: contentWidth,
      lineHeight: 14,
      color:    rgb(0.15, 0.15, 0.15),
    });

    // -----------------------------------------------------------------------
    // 5. Asset Table — top rule at Y ≈ 630 from bottom
    // -----------------------------------------------------------------------
    let tableY = fromTop(TABLE_TOP_OFFSET);

    // Top horizontal rule
    page.drawLine({
      start:     { x: PAGE_MARGIN, y: tableY },
      end:       { x: width - PAGE_MARGIN, y: tableY },
      thickness: 1,
      color:     rgb(0, 0, 0),
    });

    // Column headers
    const headerRowY = tableY - 16;
    page.drawText('S/N',                        { x: COL_SN,          y: headerRowY, size: FONT_SIZE_BODY, font: boldFont });
    page.drawText('Asset Type & Description',   { x: COL_DESC,        y: headerRowY, size: FONT_SIZE_BODY, font: boldFont });
    page.drawText('Holding Institution / Registrar', { x: COL_INSTITUTION, y: headerRowY, size: FONT_SIZE_BODY, font: boldFont });
    page.drawText('Verified Value (\u20A6)',    { x: COL_VALUE,       y: headerRowY, size: FONT_SIZE_BODY, font: boldFont });

    // Sub-header rule
    const subRuleY = headerRowY - 8;
    page.drawLine({
      start:     { x: PAGE_MARGIN, y: subRuleY },
      end:       { x: width - PAGE_MARGIN, y: subRuleY },
      thickness: 0.5,
      color:     rgb(0, 0, 0),
    });

    // -----------------------------------------------------------------------
    // 6. Data Rows — each row shifts Y down by ROW_HEIGHT points
    // -----------------------------------------------------------------------
    let currentY = subRuleY - ROW_HEIGHT;
    const SAFE_BOTTOM = FOOTER_HEIGHT + 20; // stop drawing rows before footer

    for (let i = 0; i < assets.length; i++) {
      // Guard: if we've run out of page space, stop (avoids footer overlap)
      if (currentY < SAFE_BOTTOM) break;

      const asset = assets[i];

      // Alternate row shading for readability
      if (i % 2 === 0) {
        page.drawRectangle({
          x:      PAGE_MARGIN,
          y:      currentY - 6,
          width:  contentWidth,
          height: ROW_HEIGHT,
          color:  rgb(0.96, 0.96, 0.98),
          opacity: 1,
        });
      }

      const valueStr = typeof asset.value === 'number'
        ? `\u20A6${asset.value.toLocaleString('en-NG')}`
        : `\u20A6${asset.value}`;

      page.drawText(`${i + 1}`,                            { x: COL_SN,          y: currentY, size: FONT_SIZE_BODY, font });
      page.drawText(truncate(String(asset.description), 30), { x: COL_DESC,        y: currentY, size: FONT_SIZE_BODY, font });
      page.drawText(truncate(String(asset.institution), 22), { x: COL_INSTITUTION, y: currentY, size: FONT_SIZE_BODY, font });
      page.drawText(truncate(valueStr, 18),                  { x: COL_VALUE,       y: currentY, size: FONT_SIZE_BODY, font });

      currentY -= ROW_HEIGHT;
    }

    // Closing table rule
    page.drawLine({
      start:     { x: PAGE_MARGIN, y: currentY + 6 },
      end:       { x: width - PAGE_MARGIN, y: currentY + 6 },
      thickness: 0.5,
      color:     rgb(0, 0, 0),
    });

    // -----------------------------------------------------------------------
    // 7. Authorization Footer — anchored to Y = FOOTER_HEIGHT from bottom
    // -----------------------------------------------------------------------
    const generationDate = new Date().toLocaleDateString('en-NG', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const footerRule = FOOTER_HEIGHT;
    page.drawLine({
      start:     { x: PAGE_MARGIN, y: footerRule },
      end:       { x: width - PAGE_MARGIN, y: footerRule },
      thickness: 0.5,
      color:     rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Generated by: ${administratorName} (Verified via NIMC)`, {
      x:    PAGE_MARGIN,
      y:    footerRule - 16,
      size: FONT_SIZE_FOOTER,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(`Date of Generation: ${generationDate}`, {
      x:    PAGE_MARGIN,
      y:    footerRule - 30,
      size: FONT_SIZE_FOOTER,
      font: font,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Security attestation line
    const securityNote = 'Document secured and cryptographically verified by Reclaimng Technologies. | Ref: RT-PROBATE-INVENTORY';
    page.drawText(securityNote, {
      x:    centerX(securityNote, width, 7, font),
      y:    20,
      size: 7,
      font: font,
      color: rgb(0.55, 0.55, 0.55),
    });

    // -----------------------------------------------------------------------
    // 8. Serialize & Return as Binary PDF Stream
    // -----------------------------------------------------------------------
    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'attachment; filename="Verified_Estate_Inventory.pdf"',
        'Cache-Control':       'no-store',
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[generate-inventory] PDF generation failed:', message);

    return new Response(
      JSON.stringify({ error: 'Internal server error during PDF generation.', detail: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
