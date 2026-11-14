import { nameTokens, normaliseName } from './names';

export interface DocumentCheck {
  status: 'looks_ok' | 'needs_review' | 'skipped';
  reasons: string[];
}

/**
 * A first-pass sanity check on the text read from an uploaded death
 * certificate. It only ever ADVISES the human reviewer: it never rejects a
 * family's submission on its own. (The previous check looked for the words
 * "High Court" and "Probate", which appear on Letters of Administration but
 * not on a death certificate, so genuine certificates were auto-rejected.)
 */
export function checkDeathCertificateText(text: string, deceasedName: string): DocumentCheck {
  const t = normaliseName(text);
  const reasons: string[] = [];
  if (t.length < 40) return { status: 'needs_review', reasons: ['Very little text could be read from the document. It may be a blurry photo or scan.'] };

  if (!/\bdeath\b|\bdeceased\b|\bdied\b/.test(t)) reasons.push('The words "death", "died" or "deceased" were not found.');
  if (!/certif|registration|register|medical|population commission|npc\b/.test(t)) reasons.push('It does not read like a certificate or registry extract.');

  const wanted = nameTokens(deceasedName);
  const words = new Set(t.split(' '));
  const hits = wanted.filter((w) => words.has(w)).length;
  if (wanted.length && hits < Math.min(2, wanted.length)) reasons.push('The name on the document does not clearly match the name you gave us.');

  return { status: reasons.length ? 'needs_review' : 'looks_ok', reasons };
}

/**
 * Reads the text of an uploaded file with Google Cloud Vision.
 * Returns null when OCR is not configured or fails: OCR is a helper, and its
 * absence must never block a family that has already paid.
 */
export async function readDocumentText(file: { buffer: Buffer; mimeType: string }): Promise<string | null> {
  const encoded = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64;
  if (!encoded) return null;
  try {
    const credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient({ credentials });
    const withTimeout = <T,>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OCR timed out')), 20_000))]);

    if (file.mimeType === 'application/pdf') {
      // Images go through images:annotate; PDFs must go through files:annotate.
      const [result] = await withTimeout<any>(
        client.batchAnnotateFiles({
          requests: [{ inputConfig: { mimeType: 'application/pdf', content: file.buffer }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], pages: [1, 2] }],
        }),
      );
      const pages = result?.responses?.[0]?.responses ?? [];
      return pages.map((p: any) => p?.fullTextAnnotation?.text ?? '').join('\n');
    }
    const [result] = await withTimeout<any>(client.documentTextDetection({ image: { content: file.buffer } }));
    return result?.fullTextAnnotation?.text ?? '';
  } catch (err) {
    console.warn('[document-check] OCR unavailable:', err instanceof Error ? err.message : err);
    return null;
  }
}
