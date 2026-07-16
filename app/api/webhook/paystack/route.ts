import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-paystack-signature');
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      console.error('[paystack-webhook] Missing PAYSTACK_SECRET_KEY');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // 1. Verify cryptographic signature
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    
    if (hash !== signature) {
      console.warn('[paystack-webhook] Invalid signature detected.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parse Payload
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    // 3. Process Event
    if (event === 'charge.success') {
      const userId = data.metadata?.user_id;
      const estateId = data.metadata?.estate_id;

      if (!userId) {
        console.warn('[paystack-webhook] No user_id found in metadata. Skipping.');
        // Still return 200 to acknowledge receipt
        return NextResponse.json({ received: true });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        let query = supabase.from('estates').update({ payment_status: 'paid' });
        
        // If estateId was provided, update exactly that estate. 
        // Otherwise, update the latest unpaid estate for this user.
        if (estateId) {
          query = query.eq('id', estateId);
        } else {
          // As a fallback, update all unpaid estates for this user (or we could fetch the latest one)
          query = query.eq('user_id', userId).eq('payment_status', 'unpaid');
        }

        const { error: updateError } = await query;

        if (updateError) {
          console.error('[paystack-webhook] Database update failed:', updateError.message);
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }

        console.log(`[paystack-webhook] Successfully marked payment 'paid' for user ${userId}`);
      }
    }

    // 4. Acknowledge Receipt immediately
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[paystack-webhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
