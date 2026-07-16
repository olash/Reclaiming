import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bvn } = await request.json();

    if (!bvn || bvn.length !== 11) {
      return NextResponse.json({ error: 'Valid 11-digit BVN is required' }, { status: 400 });
    }

    // Mock response simulating NIBSS iGree API
    return NextResponse.json({
      success: true,
      maskedPhone: '080****1234',
      sessionId: `mock-session-${Date.now()}`
    });

  } catch (error) {
    console.error('[request-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
