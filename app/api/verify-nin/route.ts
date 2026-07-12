import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getQoreIdToken } from '@/utils/qoreidAuth';

/**
 * POST /api/verify-nin
 *
 * Accepts NIN + applicant biodata. Hits QoreID NIN Premium endpoint for
 * cross-matched identity verification. Falls back to basic NIN lookup if
 * Premium returns a non-200. Caches results in Supabase to prevent
 * duplicate charges ("Never Pay Twice").
 *
 * Body: { nin, firstname, lastname, phone, dob, user_id }
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[verify-nin] Missing Supabase environment variables');
    }

    const supabase = createClient(
      supabaseUrl || 'https://dummy.supabase.co',
      supabaseServiceKey || 'dummy'
    );

    // ── Parse & validate body ──────────────────────────────────────────────
    let body: {
      nin?: string;
      firstname?: string;
      lastname?: string;
      phone?: string;
      dob?: string;
      user_id?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { nin, firstname, lastname, phone, dob, user_id } = body;

    if (!nin || nin.length !== 11) {
      return NextResponse.json(
        { error: 'A valid 11-digit NIN is required.' },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required.' },
        { status: 400 }
      );
    }

    // ── "Never Pay Twice" cache check ─────────────────────────────────────
    // Scoped to user_id for defence-in-depth (alongside RLS SELECT policy)
    // to prevent cross-user data leakage.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: cachedRecord, error: cacheError } = await supabase
      .from('verifications')
      .select('profile_data, created_at')
      .eq('nin', nin)
      .eq('user_id', user_id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cachedRecord && !cacheError) {
      console.log('[verify-nin] Cache hit for NIN:', nin.slice(0, 4) + '****');
      return NextResponse.json({
        success: true,
        matchStatus: 'EXACT_MATCH',
        data: cachedRecord.profile_data,
        cached: true,
      });
    }

    // ── Fetch QoreID access token ──────────────────────────────────────────
    const accessToken = await getQoreIdToken();

    // ── Attempt NIN Premium (cross-matched with biodata) ──────────────────
    const premiumResponse = await fetch(
      `https://api.qoreid.com/v1/ng/identities/nin-premium/${nin}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          firstname: firstname ?? '',
          lastname: lastname ?? '',
          phone: phone ?? '',
          dob: dob ?? '',         // expected format: YYYY-MM-DD
        }),
      }
    );

    let verifyData = await premiumResponse.json();
    let usedFallback = false;

    // ── Fallback to basic NIN lookup if Premium fails ─────────────────────
    if (!premiumResponse.ok) {
      console.warn(
        `[verify-nin] NIN Premium returned ${premiumResponse.status}. Falling back to basic NIN lookup.`
      );

      const fallbackResponse = await fetch('https://api.qoreid.com/v1/ng/identities/nin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ idNumber: nin }),
      });

      verifyData = await fallbackResponse.json();
      usedFallback = true;

      if (!fallbackResponse.ok) {
        return NextResponse.json(
          {
            error: 'Identity verification failed. The NIN could not be verified.',
            details: verifyData,
          },
          { status: fallbackResponse.status || 400 }
        );
      }
    }

    // Bypass QoreID's sandbox false-positive error string by explicitly checking the match status
    const isPerfectMatch =
      verifyData.matchStatus?.status === 'verified' ||
      verifyData.details?.summary?.nin_check?.status === 'EXACT_MATCH' ||
      verifyData.status?.status === 'verified' ||
      verifyData.summary?.nin_check?.status === 'EXACT_MATCH';

    if (!isPerfectMatch) {
      // Only throw the 422 if the actual biometric/data match failed
      return new Response(JSON.stringify(verifyData), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Write KYC record to Supabase verifications ────────────────────────
    // Columns: user_id (NOT NULL FK → auth.users), nin (UNIQUE TEXT),
    //          profile_data (JSONB — full QoreID response payload)
    const { error: insertError } = await supabase.from('verifications').insert({
      user_id,                          // satisfies NOT NULL constraint & RLS policy
      nin,
      profile_data: verifyData,         // complete QoreID JSON response
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      // Non-fatal — log and continue. A cache write failure should not block the user.
      console.warn('[verify-nin] KYC record write failed:', insertError.message);
    } else {
      console.log('[verify-nin] KYC record stored for user:', user_id.slice(0, 8) + '...');
    }

    // Return 200 OK for a successful match
    return new Response(JSON.stringify({
      success: true,
      matchStatus: 'EXACT_MATCH',
      data: verifyData,
      cached: false,
      usedFallback,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[verify-nin] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error while verifying identity.' },
      { status: 500 }
    );
  }
}
