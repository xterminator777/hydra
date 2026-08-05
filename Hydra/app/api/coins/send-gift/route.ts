import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { userId, hostId, giftCost, giftType, roomName } = await request.json();

    if (!userId || !giftCost || giftCost <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch sender's wallet balance
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletErr || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (wallet.balance < giftCost) {
      return NextResponse.json(
        { error: 'Insufficient coin balance! Please top up.' },
        { status: 402 }
      );
    }

    // 2. Deduct coins from sender
    const newBalance = wallet.balance - giftCost;
    await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    // 3. Log sender transaction
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: -giftCost,
      type: 'gift_send',
      reference_id: roomName,
      description: `Sent ${giftType} gift (${giftCost} coins)`,
    });

    // 4. (Optional) Credit host's wallet if hostId is provided
    if (hostId && hostId !== userId) {
      const { data: hostWallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', hostId)
        .maybeSingle();

      if (hostWallet) {
        await supabase
          .from('wallets')
          .update({ balance: hostWallet.balance + giftCost })
          .eq('user_id', hostId);

        await supabase.from('coin_transactions').insert({
          user_id: hostId,
          amount: giftCost,
          type: 'gift_receive',
          reference_id: roomName,
          description: `Received ${giftType} gift from user`,
        });
      }
    }

    return NextResponse.json({ success: true, newBalance });
  } catch (err: any) {
    console.error('Error processing gift transaction:', err);
    return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 500 });
  }
}