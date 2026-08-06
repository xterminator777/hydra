import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Uses service role to bypass RLS for wallet updates
);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle successful checkout
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const coinsAmount = parseInt(session.metadata?.coinsAmount || '0', 10);

    if (userId && coinsAmount > 0) {
      try {
        // 1. Fetch existing wallet
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .maybeSingle();

        const currentBalance = wallet ? wallet.balance : 0;
        const newBalance = currentBalance + coinsAmount;

        // 2. Upsert updated wallet balance
        await supabaseAdmin.from('wallets').upsert({
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        });

        // 3. Log transaction history record
        await supabaseAdmin.from('coin_transactions').insert({
          user_id: userId,
          amount: coinsAmount,
          type: 'purchase',
          description: `Purchased ${coinsAmount} Coins via Stripe`,
          reference_id: session.id,
        });

        console.log(`Successfully credited ${coinsAmount} coins to user ${userId}`);
      } catch (dbErr) {
        console.error('Error updating wallet in DB:', dbErr);
      }
    }
  }

  return NextResponse.json({ received: true });
}