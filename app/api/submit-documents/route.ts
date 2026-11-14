import { FEES, UPLOAD_RULES } from '@/lib/fees';
import { checkDeathCertificateText, readDocumentText, type DocumentCheck } from '@/lib/server/document-check';
import { HttpError, json, route } from '@/lib/server/http';
import { assertPaid, findLedgerEntry, recordLedgerEntry } from '@/lib/server/paystack';
import { latestVerification, livenessPassed } from '@/lib/server/identity';
import { livenessMode } from '@/lib/server/qoreid';
import { adminClient, requireUser } from '@/lib/server/supabase';

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

/**
 * POST /api/submit-documents        (signed-in users only, multipart/form-data)
 *
 *   death_certificate          File, required   (PDF / JPG / PNG, ≤ 10 MB)
 *   letter_of_administration   File, optional
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, 'The upload could not be read. Please try again.', 'INVALID_FORM');
  }

  const deathCert = checkFile(form.get('death_certificate') as File | null, 'death certificate', true)!;
  const loa = checkFile(form.get('letter_of_administration') as File | null, 'letter of administration', false);
  const deceasedName = String(form.get('deceased_name') ?? '').trim().replace(/\s+/g, ' ');
  if (deceasedName.length < 3) throw new HttpError(400, "Please enter your loved one's full legal name.", 'NAME_REQUIRED');
  const dateOfDeath = String(form.get('date_of_death') ?? '');
  if (dateOfDeath && (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfDeath) || new Date(dateOfDeath) > new Date())) {
    throw new HttpError(400, 'The date of death cannot be in the future.', 'INVALID_DATE');
  }
  const relationship = String(form.get('relationship') ?? '').trim().slice(0, 60);

  // ── Identity must have been confirmed first ───────────────────────────────
  const kyc = await latestVerification(user.id);
  if (!kyc) throw new HttpError(403, 'Please confirm your identity before sending documents.', 'IDENTITY_REQUIRED');
  if (livenessMode() === 'required' && !livenessPassed(kyc)) {
    throw new HttpError(403, 'Please complete the selfie check before sending documents.', 'LIVENESS_REQUIRED');
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  const payment = await assertPaid({ reference: form.get('paystack_reference'), purpose: 'submission', userId: user.id, email: user.email });

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
    return { path, buffer };
  };
  const dc = await store(deathCert, 'death_certificate');
  const loaStored = loa ? await store(loa, 'letter_of_administration') : null;

  // ── Create the case ───────────────────────────────────────────────────────
  const { data: created, error: insertError } = await supabase
    .from('estates')
    .insert({
      user_id: user.id,
      estate_name: `Estate of ${deceasedName}`,
      deceased_name: deceasedName,
      status: 'pending_review',
      payment_status: 'paid', // confirmed with Paystack above
      paystack_reference: payment.reference,
      death_certificate_path: dc.path,
      letter_of_administration_path: loaStored?.path ?? null,
      submitted_at: new Date().toISOString(),
    })
    .select('id');
  const estateId = created?.[0]?.id;
  if (insertError || !estateId) {
    console.error('[submit-documents] insert failed:', insertError?.message);
    throw new HttpError(500, 'Your payment is safe, but we could not open your case. Please press "Try again" — you will not be charged twice.', 'DB_ERROR', { reference: payment.reference });
  }
  await recordLedgerEntry({ user_id: user.id, reference: payment.reference, purpose: 'submission', amount_kobo: FEES.submission.kobo, estate_id: estateId });

  // ── Advisory document read (never blocks, never rejects) ──────────────────
  let documentCheck: DocumentCheck = { status: 'skipped', reasons: [] };
  const text = await readDocumentText({ buffer: dc.buffer, mimeType: deathCert.type });
  if (text !== null) documentCheck = checkDeathCertificateText(text, deceasedName);

  // Optional columns from migration 0005 — saved when present, ignored when not.
  const extras: Record<string, unknown> = { document_check: documentCheck };
  if (dateOfDeath) extras.date_of_death = dateOfDeath;
  if (relationship) extras.relationship = relationship;
  const { error: extrasError } = await supabase.from('estates').update(extras).eq('id', estateId);
  if (extrasError) console.warn('[submit-documents] optional fields not saved (run migration 0005):', extrasError.message);

  return json({ success: true, estateId, documentCheck: { status: documentCheck.status } });
});
