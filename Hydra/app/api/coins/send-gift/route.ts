import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { userId, recipientUsername, giftCost, giftType, roomName } = await request.json();

    if (!userId || !giftCost || giftCost <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch sender's wallet balance
    const { data: senderWallet, error: walletErr } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletErr || !senderWallet) {
      return NextResponse.json({ error: 'Sender wallet not found' }, { status: 404 });
    }

    if (senderWallet.balance < giftCost) {
      return NextResponse.json(
        { error: 'Insufficient coin balance!' },
        { status: 402 }
      );
    }

    // 2. Deduct coins from sender
    const newSenderBalance = senderWallet.balance - giftCost;
    await supabase
      .from('wallets')
      .update({ balance: newSenderBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    // 3. Log sender transaction
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: -giftCost,
      type: 'gift_send',
      reference_id: roomName,
      description: `Sent ${giftType} gift to @${recipientUsername || 'host'}`,
    });

    // 4. 🟢 CREDIT RECIPIENT'S WALLET
    if (recipientUsername) {
      // Resolve recipient username to profile user_id
      const { data: recipientProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', recipientUsername)
        .maybeSingle();

      if (recipientProfile?.id) {
        const recipientId = recipientProfile.id;

        // Fetch recipient wallet
        const { data: recipientWallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', recipientId)
          .maybeSingle();

        const currentRecipientBalance = recipientWallet?.balance || 0;
        const newRecipientBalance = currentRecipientBalance + giftCost;

        // Credit recipient wallet
        await supabase.from('wallets').upsert(
          {
            user_id: recipientId,
            balance: newRecipientBalance,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        // Log recipient transaction
        await supabase.from('coin_transactions').insert({
          user_id: recipientId,
          amount: giftCost,
          type: 'gift_receive',
          reference_id: roomName,
          description: `Received ${giftType} gift from user`,
        });
      }
    }

    return NextResponse.json({ success: true, newBalance: newSenderBalance });
  } catch (err: any) {
    console.error('Error processing gift transaction:', err);
    return NextResponse.json({ error: err.message || 'Transaction failed' }, { status: 500 });
  }
}
