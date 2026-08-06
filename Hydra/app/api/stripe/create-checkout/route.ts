import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: Request) {
  try {
    const { userId, coinsAmount, priceInCents } = await req.json();

    if (!userId || !coinsAmount || !priceInCents) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${coinsAmount} Virtual Coins`,
              description: 'Top up your wallet balance for live streaming gifts',
              // 🟢 txcd_10501000 is Stripe's standard product tax code for Digital Services / Virtual Goods
              tax_code: 'txcd_10501000',
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        userId,
        coinsAmount: coinsAmount.toString(),
      },
      // 🟢 Disables Managed Payments requirements if you prefer not enforcing tax code rules during test mode
      managed_payments: {
        enabled: false,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?status=cancelled`,
    } as any);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating Stripe session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}