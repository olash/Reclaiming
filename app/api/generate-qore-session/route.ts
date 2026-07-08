import { NextResponse } from 'next/server';

/**
 * POST /api/generate-qore-session
 *
 * Mints a short-lived QoreID SDK session token for the Liveness widget.
 * Uses HTTP Basic Auth (Base64 clientId:secret) as required by QoreID.
 *
 * SECURITY: This runs server-side only. Credentials never touch the browser.
 */
export async function POST() {
  try {
    const clientId = process.env.QOREID_CLIENT_ID;
    const clientSecret = process.env.QOREID_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[generate-qore-session] Missing QOREID_CLIENT_ID or QOREID_CLIENT_SECRET');
      return NextResponse.json(
        { error: 'Identity service is currently unavailable.' },
        { status: 503 }
      );
    }

    // QoreID requires Basic Auth: Base64(clientId:secret)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.qoreid.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({ productCode: 'liveness' }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[generate-qore-session] QoreID returned non-200:', response.status, errBody);
      return NextResponse.json(
        { error: 'Failed to initialise identity session. Please try again.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.sdkSessionToken) {
      console.error('[generate-qore-session] No sdkSessionToken in response:', data);
      return NextResponse.json(
        { error: 'Identity session token was not returned. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ sdkSessionToken: data.sdkSessionToken });

  } catch (error) {
    console.error('[generate-qore-session] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error during session generation.' },
      { status: 500 }
    );
  }
}
