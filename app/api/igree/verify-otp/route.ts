import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { sessionId, otp, estateId, estate_id } = await request.json();
    const finalEstateId = estate_id || estateId;

    if (!sessionId || !otp) {
      return NextResponse.json({ error: 'Session ID and OTP are required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const monoSecKey = process.env.MONO_SEC_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !monoSecKey) {
      console.error('[verify-otp] Missing environment variables.');
      return NextResponse.json({ error: 'Server configuration error: Missing Mono credentials' }, { status: 503 });
    }

    // 1. Mono Auto-Route: Details
    const detailsRes = await fetch('https://api.withmono.com/v2/lookup/bvn/details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': monoSecKey,
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        otp: otp
      })
    });

    const detailsData = await detailsRes.json();

    if (!detailsRes.ok) {
      console.error('[verify-otp] Mono details failed:', detailsData);
      return NextResponse.json({ error: detailsData.message || 'Failed to verify OTP with Mono' }, { status: detailsRes.status });
    }

    // `detailsData.data` is an array of accounts returned by Mono
    const discoveredAccounts = Array.isArray(detailsData.data) ? detailsData.data : [];

    // Phase 4: Database Update (if finalEstateId is provided)
    if (finalEstateId) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: updateError } = await supabase
        .from('estates')
        .update({
          status: 'verified',
          discovered_accounts: discoveredAccounts
        })
        .eq('id', finalEstateId);
        
      if (updateError) {
        console.error('[verify-otp] DB update failed:', updateError.message);
      } else {
        console.log(`[verify-otp] Estate ${finalEstateId} updated to verified with ${discoveredAccounts.length} accounts`);
      }
    } else {
      console.warn('[verify-otp] No estate_id provided in payload. Skipping DB update.');
    }

    return NextResponse.json({
      success: true,
      message: 'BVN verified successfully',
      accounts: discoveredAccounts
    });

  } catch (error) {
    console.error('[verify-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
