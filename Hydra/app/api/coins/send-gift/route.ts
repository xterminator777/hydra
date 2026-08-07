import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { userId, recipientUsername, giftCost, giftType, roomName } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get Sender Wallet & Profile
    const { data: senderWallet, error: senderErr } = await supabase
      .from('wallets')
      .select('id, balance, paid_balance, promo_balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (senderErr || !senderWallet) {
      console.error('Sender wallet error:', senderErr?.message);
      return NextResponse.json({ error: 'Sender wallet not found' }, { status: 404 });
    }

    // Fetch Sender's Profile for the Host's transaction log
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle();

    const senderUsername = senderProfile?.username || 'user';

    // Handle initial balances safely
    const paidBal = senderWallet.paid_balance ?? 0;
    const promoBal = senderWallet.promo_balance ?? senderWallet.balance ?? 0;
    const totalBalance = paidBal + promoBal;

    if (totalBalance < giftCost) {
      return NextResponse.json({ error: 'Insufficient coin balance' }, { status: 400 });
    }

    // 2. Calculate deduction order (Spend promo coins first, then paid coins)
    let promoDeduction = 0;
    let paidDeduction = 0;

    if (promoBal >= giftCost) {
      promoDeduction = giftCost;
    } else {
      promoDeduction = promoBal;
      paidDeduction = giftCost - promoDeduction;
    }

    const newPromoBalance = promoBal - promoDeduction;
    const newPaidBalance = paidBal - paidDeduction;
    const newTotalBalance = newPromoBalance + newPaidBalance;
    const isPromoGift = promoDeduction > 0;

    // 3. Deduct from Sender Wallet
    const { error: updateSenderErr } = await supabase
      .from('wallets')
      .update({
        balance: newTotalBalance,
        promo_balance: newPromoBalance,
        paid_balance: newPaidBalance,
      })
      .eq('id', senderWallet.id);

    if (updateSenderErr) {
      console.error('Failed to update sender wallet:', updateSenderErr.message);
      return NextResponse.json({ error: 'Failed to update sender wallet' }, { status: 500 });
    }

    // 4. Look up Host Profile & Credit Host Wallet
    let hostUserId: string | null = null;

    if (recipientUsername) {
      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', recipientUsername)
        .maybeSingle();

      if (hostProfile) {
        hostUserId = hostProfile.id;

        const { data: hostWallet } = await supabase
          .from('wallets')
          .select('id, balance, paid_balance, promo_balance')
          .eq('user_id', hostProfile.id)
          .maybeSingle();

        if (hostWallet) {
          const hostPaid = hostWallet.paid_balance ?? 0;
          const hostPromo = hostWallet.promo_balance ?? 0;
          const newHostPaid = hostPaid + paidDeduction;
          const newHostPromo = hostPromo + promoDeduction;
          const newHostTotal = newHostPaid + newHostPromo;

          await supabase
            .from('wallets')
            .update({
              balance: newHostTotal,
              paid_balance: newHostPaid,
              promo_balance: newHostPromo,
            })
            .eq('id', hostWallet.id);
        }
      }
    }

    const cleanGiftName = giftType || 'gift';
    const targetHostName = recipientUsername || 'host';

    // 5. 🟢 RECORD LOG FOR SENDER (e.g. "Sent Fire gift to @Maddog")
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: giftCost,
      type: 'gift_send',
      description: `Sent ${cleanGiftName} gift to @${targetHostName}`,
      reference_id: roomName,
      is_promo: isPromoGift,
    });

    // 6. 🟢 RECORD LOG FOR HOST (e.g. "Received Fire gift from @amunRa")
    if (hostUserId) {
      await supabase.from('coin_transactions').insert({
        user_id: hostUserId,
        amount: giftCost,
        type: 'gift_receive',
        description: `Received ${cleanGiftName} gift from @${senderUsername}`,
        reference_id: roomName,
        is_promo: isPromoGift,
      });
    }

    return NextResponse.json({
      success: true,
      newBalance: newTotalBalance,
    });
  } catch (err: any) {
    console.error('Unhandled error in send-gift:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}