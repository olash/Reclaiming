import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/config
 *
 * Public, browser-safe settings only. Kept for backwards compatibility with
 * older clients; the app itself reads NEXT_PUBLIC_* values at build time.
 * Server secrets are never returned here.
 */
export async function GET(): Promise<Response> {
  const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!paystackPublicKey) {
    console.error('[api/config] NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY is not set.');
    return NextResponse.json({ error: 'Payment gateway is not configured. Please contact support.' }, { status: 503 });
  }
  return NextResponse.json(
    {
      paystackPublicKey,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' } },
  );
}
