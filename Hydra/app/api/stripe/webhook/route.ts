import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypasses RLS to update wallet balance safely
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
        // 1. Check if a wallet row already exists by user_id
        const { data: existingWallet, error: fetchError } = await supabaseAdmin
          .from('wallets')
          .select('id, balance')
          .eq('user_id', userId)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching wallet:', fetchError);
        }

        if (existingWallet) {
          // 🟢 2A. Update existing wallet row by primary key ('id')
          const newBalance = (existingWallet.balance || 0) + coinsAmount;

          const { error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({
              balance: newBalance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingWallet.id);

          if (updateError) {
            console.error('Error updating existing wallet:', updateError);
          } else {
            console.log(`Updated wallet for ${userId}. New balance: ${newBalance}`);
          }
        } else {
          // 🟢 2B. Insert brand-new wallet row if user doesn't have one yet
          const { error: insertError } = await supabaseAdmin
            .from('wallets')
            .insert({
              user_id: userId,
              balance: coinsAmount,
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Error inserting new wallet:', insertError);
          } else {
            console.log(`Created new wallet for ${userId} with balance: ${coinsAmount}`);
          }
        }

        // 3. Log transaction history record
        const { error: txError } = await supabaseAdmin
          .from('coin_transactions')
          .insert({
            user_id: userId,
            amount: coinsAmount,
            type: 'purchase',
            description: `Purchased ${coinsAmount} Coins via Stripe`,
            reference_id: session.id,
          });

        if (txError) {
          console.error('Error inserting coin transaction record:', txError);
        }

      } catch (dbErr) {
        console.error('Error executing DB updates in webhook:', dbErr);
      }
    }
  }

  return NextResponse.json({ received: true });
}