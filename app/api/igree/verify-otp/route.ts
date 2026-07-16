import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { sessionId, otp, estateId } = await request.json();

    if (!sessionId || !otp) {
      return NextResponse.json({ error: 'Session ID and OTP are required' }, { status: 400 });
    }

    // Mock validation
    if (otp !== '123456') {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 });
    }

    // Mock discovered accounts
    const mockAccounts = [
      { bankName: 'GTBank', accountNumber: '0123456789', balance: 2500000 },
      { bankName: 'Zenith Bank', accountNumber: '2123456789', balance: 2000000 }
    ];
    const totalAssetValue = 4500000;

    // Phase 4: Database Update (if estateId is provided)
    if (estateId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { error: updateError } = await supabase
          .from('estates')
          .update({
            status: 'verified',
            total_asset_value: totalAssetValue
          })
          .eq('id', estateId);
          
        if (updateError) {
          console.error('[verify-otp] DB update failed:', updateError.message);
        } else {
          console.log(`[verify-otp] Estate ${estateId} updated to verified with value ${totalAssetValue}`);
        }
      } else {
        console.warn('[verify-otp] Missing Supabase keys. Cannot update estate.');
      }
    } else {
      console.warn('[verify-otp] No estateId provided in payload. Skipping DB update.');
    }

    return NextResponse.json({
      success: true,
      message: 'BVN verified successfully',
      accounts: mockAccounts,
      totalAssetValue
    });

  } catch (error) {
    console.error('[verify-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
