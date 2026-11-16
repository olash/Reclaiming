import { FEES, UPLOAD_RULES } from '@/lib/fees';
import { checkDeathCertificateText, readDocumentText, type DocumentCheck } from '@/lib/server/document-check';
import { HttpError, json, readJson, route } from '@/lib/server/http';
import { assertPaid, findLedgerEntry, recordLedgerEntry } from '@/lib/server/paystack';
import { latestVerification, livenessPassed } from '@/lib/server/identity';
import { livenessMode } from '@/lib/server/qoreid';
import { adminClient, insertTolerant, requireUser } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function checkFile(file: File | null, label: string, required: boolean): File | null {
  if (!file || typeof file === 'string' || file.size === 0) {
    if (required) throw new HttpError(400, `Please attach the ${label}.`, 'FILE_REQUIRED');
    return null;
  }
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!UPLOAD_RULES.extensions.includes(ext as any) || !UPLOAD_RULES.mimeTypes.includes(file.type as any)) {
    throw new HttpError(415, `The ${label} must be a PDF, JPG or PNG file.`, 'FILE_TYPE');
  }
  if (file.size > UPLOAD_RULES.maxBytes) throw new HttpError(413, `The ${label} is larger than 10 MB. Please upload a smaller file.`, 'FILE_TOO_LARGE');
  return file;
}

/** What a stored file really is, from its first bytes (never trust the name). */
function sniff(b: Buffer): string | null {
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/** A path the browser uploaded to: only inside the caller's own folder, with a document extension. */
function checkPath(value: unknown, userId: string, label: string, required: boolean): string | null {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!path) {
    if (required) throw new HttpError(400, `Please attach the ${label}.`, 'FILE_REQUIRED');
    return null;
  }
  const ok = new RegExp(`^${userId}/[A-Za-z0-9._-]{1,120}\\.(pdf|jpe?g|png|webp)$`, 'i').test(path) && !path.includes('..');
  if (!ok) throw new HttpError(400, `The ${label} upload could not be found. Please attach it again.`, 'INVALID_PATH');
  return path;
}

/**
 * POST /api/submit-documents        (signed-in users only)
 *
 * Preferred, application/json: the browser first uploads the files straight
 * to the private storage bucket (its rules only allow the caller's own
 * folder), then sends their paths. Large phone photos never pass through
 * this function, whose request body is capped at 4.5 MB on Vercel.
 *   death_certificate_path          string, required   ("<user id>/<file>")
 *   letter_of_administration_path   string, optional
 *
 * Older clients, multipart/form-data, with the files themselves:
 *   death_certificate          File, required   (PDF / JPG / PNG, ≤ 10 MB)
 *   letter_of_administration   File, optional
 *
 * Both also send:
 *   deceased_name              string, required
 *   date_of_death              string, optional (YYYY-MM-DD)
 *   relationship               string, optional
 *   paystack_reference         string, required
 *
 * Order matters: the payment is confirmed with Paystack BEFORE anything is
 * stored, and nothing after the payment check can strand a paid family — the
 * automated document read is advisory and never rejects a submission.
 * Sending the same payment reference again returns the case it already
 * created, so a retry after a dropped connection is always safe.
 */
export const POST = route('submit-documents', async (request) => {
  const user = await requireUser(request);
  const supabase = adminClient();

  const isJson = (request.headers.get('content-type') ?? '').includes('application/json');
  let get: (key: string) => unknown;
  let deathCert: File | null = null;
  let loa: File | null = null;
  let dcPath: string | null = null;
  let loaPath: string | null = null;
  if (isJson) {
    const body = await readJson<Record<string, unknown>>(request);
    get = (key) => body[key];
    dcPath = checkPath(body.death_certificate_path, user.id, 'death certificate', true);
    loaPath = checkPath(body.letter_of_administration_path, user.id, 'letter of administration', false);
  } else {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new HttpError(400, 'The upload could not be read. Please try again.', 'INVALID_FORM');
    }
    get = (key) => form.get(key);
    deathCert = checkFile(form.get('death_certificate') as File | null, 'death certificate', true)!;
    loa = checkFile(form.get('letter_of_administration') as File | null, 'letter of administration', false);
  }

  const deceasedName = String(get('deceased_name') ?? '').trim().replace(/\s+/g, ' ');
  if (deceasedName.length < 3) throw new HttpError(400, "Please enter your loved one's full legal name.", 'NAME_REQUIRED');
  const dateOfDeath = String(get('date_of_death') ?? '');
  if (dateOfDeath && (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfDeath) || new Date(dateOfDeath) > new Date())) {
    throw new HttpError(400, 'The date of death cannot be in the future.', 'INVALID_DATE');
  }
  const relationship = String(get('relationship') ?? '').trim().slice(0, 60);

  // ── Identity must have been confirmed first ───────────────────────────────
  const kyc = await latestVerification(user.id);
  if (!kyc) throw new HttpError(403, 'Please confirm your identity before sending documents.', 'IDENTITY_REQUIRED');
  if (livenessMode() === 'required' && !livenessPassed(kyc)) {
    throw new HttpError(403, 'Please complete the selfie check before sending documents.', 'LIVENESS_REQUIRED');
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  const payment = await assertPaid({ reference: get('paystack_reference'), purpose: 'submission', userId: user.id, email: user.email });

  const { data: prior } = await supabase.from('estates').select('id, user_id').eq('paystack_reference', payment.reference).limit(1);
  if (prior?.[0]) {
    if (prior[0].user_id !== user.id) throw new HttpError(402, 'That payment has already been used.', 'PAYMENT_ALREADY_USED');
    return json({ success: true, estateId: prior[0].id, alreadySubmitted: true });
  }
  const ledger = await findLedgerEntry(payment.reference);
  if (ledger && (ledger.user_id !== user.id || ledger.purpose !== 'submission')) {
    throw new HttpError(402, 'That payment has already been used.', 'PAYMENT_ALREADY_USED');
  }

  // ── Store the files ───────────────────────────────────────────────────────
  const stamp = Date.now();
  const store = async (file: File, slug: string) => {
    const ext = (file.name.split('.').pop() ?? 'pdf').toLowerCase();
    const path = `${user.id}/${stamp}_${slug}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from('probate_documents').upload(path, buffer, { contentType: file.type, upsert: false });
    if (error) {
      console.error(`[submit-documents] ${slug} upload failed:`, error.message);
      throw new HttpError(502, 'Your payment is safe, but we could not save your documents. Please press "Try again" — you will not be charged twice.', 'UPLOAD_FAILED', { reference: payment.reference });
    }
    return { path, buffer, type: file.type };
  };
  // Files the browser already put in storage: confirm they exist, fit, and really are documents.
  const stored = async (path: string, label: string) => {
    const { data, error } = await supabase.storage.from('probate_documents').download(path);
    if (error || !data) {
      throw new HttpError(400, `Your payment is safe, but we could not find the uploaded ${label}. Please attach it again and press Send; you will not be charged twice.`, 'FILE_MISSING', { reference: payment.reference });
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length > UPLOAD_RULES.maxBytes) throw new HttpError(413, `The ${label} is larger than 10 MB. Please upload a smaller file.`, 'FILE_TOO_LARGE');
    const type = sniff(buffer);
    if (!type) throw new HttpError(415, `The ${label} must be a PDF, JPG or PNG file.`, 'FILE_TYPE');
    return { path, buffer, type };
  };
  const dc = dcPath ? await stored(dcPath, 'death certificate') : await store(deathCert!, 'death_certificate');
  const loaStored = loaPath ? await stored(loaPath, 'letter of administration') : loa ? await store(loa, 'letter_of_administration') : null;

  // ── Create the case ───────────────────────────────────────────────────────
  const { data: created, error: insertError } = await insertTolerant('estates', {
      user_id: user.id,
      estate_name: `Estate of ${deceasedName}`,
      deceased_name: deceasedName,
      status: 'pending_review',
      payment_status: 'paid', // confirmed with Paystack above
      paystack_reference: payment.reference,
      death_certificate_path: dc.path,
      letter_of_administration_path: loaStored?.path ?? null,
      submitted_at: new Date().toISOString(),
    });
  const estateId = (created as unknown as Array<{ id: string }> | null)?.[0]?.id;
  if (insertError || !estateId) {
    console.error('[submit-documents] insert failed:', insertError?.message);
    throw new HttpError(500, 'Your payment is safe, but we could not open your case. Please press "Try again" — you will not be charged twice.', 'DB_ERROR', { reference: payment.reference });
  }
  await recordLedgerEntry({ user_id: user.id, reference: payment.reference, purpose: 'submission', amount_kobo: FEES.submission.kobo, estate_id: estateId });

  // ── Advisory document read (never blocks, never rejects) ──────────────────
  let documentCheck: DocumentCheck = { status: 'skipped', reasons: [] };
  const text = await readDocumentText({ buffer: dc.buffer, mimeType: dc.type });
  if (text !== null) documentCheck = checkDeathCertificateText(text, deceasedName);

  // Optional columns from migration 0005 — saved when present, ignored when not.
  const extras: Record<string, unknown> = { document_check: documentCheck };
  if (dateOfDeath) extras.date_of_death = dateOfDeath;
  if (relationship) extras.relationship = relationship;
  const { error: extrasError } = await supabase.from('estates').update(extras).eq('id', estateId);
  if (extrasError) console.warn('[submit-documents] optional fields not saved (run migration 0005):', extrasError.message);

  return json({ success: true, estateId, documentCheck: { status: documentCheck.status } });
});
