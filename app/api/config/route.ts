import { NextResponse } from 'next/server';

/**
 * GET /api/config
 *
 * Returns a safe subset of public environment variables for consumption
 * by static HTML pages in /public (which cannot read process.env directly).
 *
 * SECURITY CONTRACT:
 *  - Only NEXT_PUBLIC_ prefixed keys (safe-for-browser values) are returned.
 *  - Server-only secrets (PAYSTACK_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *    QOREID_CLIENT_SECRET, etc.) are NEVER included here.
 *  - This endpoint requires NO authentication — it is intentionally public
 *    because the values it returns are already public by design.
 */
export async function GET(): Promise<Response> {
  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  if (!paystackPublicKey) {
    console.error('[api/config] NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set.');
    return NextResponse.json(
      { error: 'Payment gateway is not configured. Please contact support.' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      paystackPublicKey,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    {
      status: 200,
      headers: {
        // Cache for 5 minutes in the browser — keys change rarely.
        // Vercel CDN will also cache at the edge layer.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    }
  );
}
