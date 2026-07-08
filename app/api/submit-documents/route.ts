import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/submit-documents
 *
 * Accepts multipart/form-data containing:
 *   - death_certificate (File, required)
 *   - letter_of_administration (File, optional)
 *   - estate_name (string, required)
 *   - deceased_name (string, required)
 *   - paystack_reference (string, required — proof of ₦75k payment)
 *   - user_id (string, required — from auth session)
 *
 * Uploads files to Supabase Storage bucket: probate_documents
 * Inserts a tracking row into the `estates` table.
 *
 * SECURITY: Uses service_role key server-side. RLS on `estates` table
 * ensures users can only read their own records via client SDK.
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error. Please contact support.' },
        { status: 503 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Parse multipart form data ─────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
    }

    const deathCertFile = formData.get('death_certificate') as File | null;
    const loaFile = formData.get('letter_of_administration') as File | null;
    const estateName = formData.get('estate_name') as string | null;
    const deceasedName = formData.get('deceased_name') as string | null;
    const paystackRef = formData.get('paystack_reference') as string | null;
    const userId = formData.get('user_id') as string | null;

    // ── Validate required fields ──────────────────────────────────────────
    if (!deathCertFile || deathCertFile.size === 0) {
      return NextResponse.json(
        { error: 'Death Certificate is required.' },
        { status: 400 }
      );
    }
    if (!paystackRef) {
      return NextResponse.json(
        { error: 'Payment reference is required.' },
        { status: 400 }
      );
    }
    if (!userId) {
      return NextResponse.json(
        { error: 'User authentication is required.' },
        { status: 401 }
      );
    }

    const timestamp = Date.now();
    const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
    const uploadedPaths: string[] = [];

    // ── Upload Death Certificate ──────────────────────────────────────────
    const dcExt = deathCertFile.name.split('.').pop() ?? 'pdf';
    const dcPath = `${safeUserId}/${timestamp}_death_certificate.${dcExt}`;
    const dcBuffer = Buffer.from(await deathCertFile.arrayBuffer());

    const { error: dcError } = await supabase.storage
      .from('probate_documents')
      .upload(dcPath, dcBuffer, {
        contentType: deathCertFile.type || 'application/octet-stream',
        upsert: false,
      });

    if (dcError) {
      console.error('[submit-documents] Death Certificate upload failed:', dcError.message);
      return NextResponse.json(
        { error: 'Failed to upload Death Certificate. Please try again.' },
        { status: 500 }
      );
    }
    uploadedPaths.push(dcPath);

    // ── Upload Letter of Administration (optional) ────────────────────────
    let loaPath: string | null = null;
    if (loaFile && loaFile.size > 0) {
      const loaExt = loaFile.name.split('.').pop() ?? 'pdf';
      loaPath = `${safeUserId}/${timestamp}_letter_of_administration.${loaExt}`;
      const loaBuffer = Buffer.from(await loaFile.arrayBuffer());

      const { error: loaError } = await supabase.storage
        .from('probate_documents')
        .upload(loaPath, loaBuffer, {
          contentType: loaFile.type || 'application/octet-stream',
          upsert: false,
        });

      if (loaError) {
        // Non-fatal: log but continue — LoA is optional
        console.warn('[submit-documents] LoA upload failed:', loaError.message);
        loaPath = null;
      } else {
        uploadedPaths.push(loaPath);
      }
    }

    // ── Insert estate record ──────────────────────────────────────────────
    const { data: estate, error: insertError } = await supabase
      .from('estates')
      .insert({
        user_id: userId,
        estate_name: estateName ?? 'Unknown Estate',
        deceased_name: deceasedName ?? 'Unknown',
        status: 'pending_review',
        paystack_reference: paystackRef,
        death_certificate_path: dcPath,
        letter_of_administration_path: loaPath,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[submit-documents] DB insert failed:', insertError.message);
      // Files are already uploaded — don't fail silently, but don't block user
      return NextResponse.json(
        { error: 'Documents uploaded but record creation failed. Please contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      estateId: estate.id,
      uploadedPaths,
      message: 'Documents received. Your application is now pending compliance review.',
    });

  } catch (error) {
    console.error('[submit-documents] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error during document submission.' },
      { status: 500 }
    );
  }
}
