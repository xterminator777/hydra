import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { userId, recipientUsername, giftCost, giftType, roomName } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get Sender Wallet
    const { data: senderWallet, error: senderErr } = await supabase
      .from('wallets')
      .select('id, balance, paid_balance, promo_balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (senderErr || !senderWallet) {
      console.error('Sender wallet error:', senderErr?.message);
      return NextResponse.json({ error: 'Sender wallet not found' }, { status: 404 });
    }

    // Handle initial balances safely (fallback to balance if paid/promo are null)
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

    // 3. 🟢 Deduct from Sender (Updates balance, promo_balance, AND paid_balance)
    const { error: updateSenderErr } = await supabase
      .from('wallets')
      .update({
        balance: newTotalBalance, // 👈 Fixes traditional static balance column
        promo_balance: newPromoBalance,
        paid_balance: newPaidBalance,
      })
      .eq('id', senderWallet.id);

    if (updateSenderErr) {
      console.error('Failed to update sender wallet:', updateSenderErr.message);
      return NextResponse.json({ error: 'Failed to update sender wallet' }, { status: 500 });
    }

    // 4. Look up Host Profile
    if (recipientUsername) {
      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', recipientUsername)
        .maybeSingle();

      if (hostProfile) {
        // Get Host Wallet
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

          // 🟢 Credit Host Wallet
          await supabase
            .from('wallets')
            .update({
              balance: newHostTotal, // 👈 Keeps host static balance in sync
              paid_balance: newHostPaid,
              promo_balance: newHostPromo,
            })
            .eq('id', hostWallet.id);
        }
      }
    }

    // 5. Record Transaction Log
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: giftCost,
      type: 'gift_send',
      reference_id: roomName,
      is_promo: isPromoGift,
    });

    return NextResponse.json({
      success: true,
      newBalance: newTotalBalance,
    });
  } catch (err: any) {
    console.error('Unhandled error in send-gift:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}