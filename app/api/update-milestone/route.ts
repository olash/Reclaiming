import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { estateId, mandateAcknowledged } = await request.json();

    if (!estateId || mandateAcknowledged === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[update-milestone] Missing environment variables.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from('estates')
      .update({ mandate_acknowledged: mandateAcknowledged })
      .eq('id', estateId);

    if (updateError) {
      console.error('[update-milestone] Failed to update estate:', updateError.message);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Milestone updated successfully' });

  } catch (error) {
    console.error('[update-milestone] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
