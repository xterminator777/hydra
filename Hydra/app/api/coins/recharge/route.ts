import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { userId, coinsToAdd } = await request.json();

    if (!userId || !coinsToAdd || coinsToAdd <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch current wallet balance
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletErr) {
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    const currentBalance = wallet?.balance || 0;
    const newBalance = currentBalance + coinsToAdd;

    // 2. Update or insert the new balance
    // 🟢 2. FIXED: Pass onConflict so Supabase updates existing user_id rows
    const { error: updateErr } = await supabase
      .from('wallets')
      .upsert(
        {
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' } // Tells Postgres to UPDATE if user_id already exists!
      );

    if (updateErr) {
      console.error('Failed to update wallet:', updateErr.message);
      return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 });
    } 

    // 3. Log transaction history
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: coinsToAdd,
      type: 'purchase',
      description: `Demo top-up of ${coinsToAdd} coins`,
    });

    return NextResponse.json({ success: true, newBalance });
  } catch (err: any) {
    console.error('Error recharging coins:', err);
    return NextResponse.json({ error: err.message || 'Recharge failed' }, { status: 500 });
  }
}