import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { bvn } = await request.json();

    // 1. Strict Server-Side Validation
    if (!bvn || !/^\d{11}$/.test(bvn)) {
      return NextResponse.json({ error: 'Valid 11-digit numeric BVN is required' }, { status: 400 });
    }

    // Capture IP for rate limiting
    // Note: In Vercel, x-forwarded-for header contains the real IP
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Attempt to extract userId from headers if passed, else null
    // Since this route doesn't require auth yet, we rely heavily on IP
    const userId = request.headers.get('x-user-id') || null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const monoSecKey = process.env.MONO_SEC_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !monoSecKey) {
      console.error('[request-otp] Missing environment variables.');
      return NextResponse.json({ error: 'Server configuration error: Missing Mono credentials' }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Throttling System: Max 3 requests per hour per IP
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { count, error: countError } = await supabase
      .from('bvn_request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .gte('created_at', oneHourAgo.toISOString());

    if (countError) {
      console.error('[request-otp] Rate limit check failed:', countError.message);
      return NextResponse.json({ error: 'Internal error checking rate limit' }, { status: 500 });
    }

    if (count !== null && count >= 3) {
      console.warn(`[request-otp] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // 3. Mono Auto-Route: Initiate
    const initiateRes = await fetch('https://api.withmono.com/v2/lookup/bvn/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': monoSecKey
      },
      body: JSON.stringify({
        bvn: bvn,
        scope: "bank_accounts"
      })
    });

    const initiateData = await initiateRes.json();

    if (!initiateRes.ok || !initiateData.session_id) {
      // Log failed attempt
      await supabase.from('bvn_request_logs').insert({ ip_address: ip, user_id: userId, bvn, status: 'failed_initiate' });
      return NextResponse.json({ error: initiateData.message || 'Failed to initiate BVN lookup' }, { status: initiateRes.status });
    }

    const sessionId = initiateData.session_id;

    // 4. Mono Auto-Route: Verify (Trigger OTP)
    const verifyRes = await fetch('https://api.withmono.com/v2/lookup/bvn/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mono-sec-key': monoSecKey,
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        method: "phone"
      })
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      await supabase.from('bvn_request_logs').insert({ ip_address: ip, user_id: userId, bvn, status: 'failed_verify' });
      return NextResponse.json({ error: verifyData.message || 'Failed to trigger OTP' }, { status: verifyRes.status });
    }

    // Log success
    await supabase.from('bvn_request_logs').insert({ ip_address: ip, user_id: userId, bvn, status: 'success' });

    // Return session_id and hint to frontend
    return NextResponse.json({
      success: true,
      sessionId: sessionId,
      message: verifyData.message || 'OTP sent to registered phone'
    });

  } catch (error) {
    console.error('[request-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
