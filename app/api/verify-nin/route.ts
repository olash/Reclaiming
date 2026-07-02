import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getQoreIdToken } from '@/utils/qoreidAuth';

export async function POST(request: Request) {
  try {
    // Initialize Supabase client inside the handler to prevent build-time crashes
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Missing Supabase environment variables');
    }
    
    const supabase = createClient(
      supabaseUrl || 'https://dummy.supabase.co', 
      supabaseServiceKey || 'dummy'
    );

    const { nin } = await request.json();

    if (!nin) {
      return NextResponse.json({ error: 'NIN is required' }, { status: 400 });
    }

    // Objective 2: Implement "Never Pay Twice" Database Caching
    // Query the 'verifications' table using the provided NIN for records less than 30 days old.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: cachedRecord, error: cacheError } = await supabase
      .from('verifications')
      .select('profile_data, created_at')
      .eq('nin', nin)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cachedRecord && !cacheError) {
      // Return cached profile data immediately without hitting QoreID
      return NextResponse.json({ success: true, data: cachedRecord.profile_data, cached: true });
    }

    // Cache Miss: Fetch a fresh token and hit QoreID
    const accessToken = await getQoreIdToken();

    const verifyResponse = await fetch('https://api.qoreid.com/v1/ng/identities/nin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ idNumber: nin }),
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || verifyData.status !== 'EXACT_MATCH') {
      return NextResponse.json(
        { error: 'Verification failed or not an exact match', details: verifyData }, 
        { status: verifyResponse.status || 400 }
      );
    }

    // Asynchronously write the verified data into the Supabase cache table
    // (Awaiting to ensure Edge function doesn't kill execution before network request finishes)
    await supabase.from('verifications').insert({
      nin: nin,
      profile_data: verifyData,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: verifyData, cached: false });

  } catch (error) {
    console.error('NIN Verification Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while verifying NIN' }, 
      { status: 500 }
    );
  }
}
