import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getStripe, getAppUrl } from '@/lib/stripe/server';
import { tierToPriceId, stripeSecretConfigured } from '@/lib/stripe/tiers';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!stripeSecretConfigured()) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY and recurring Price IDs.' },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const tier = body?.tier as string;
    if (tier !== 'pro' && tier !== 'creator') {
      return NextResponse.json({ error: 'Invalid tier. Use "pro" or "creator".' }, { status: 400 });
    }

    const priceId = tierToPriceId(tier);
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID not configured for this tier.' }, { status: 503 });
    }

    const admin = getServiceRoleSupabase();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .maybeSingle();

    const stripe = getStripe();
    const base = getAppUrl();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/dashboard/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/dashboard/subscription?checkout=cancel`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      metadata: {
        supabase_user_id: user.id,
        wist_tier: tier,
      },
    };

    const customerId = profile?.stripe_customer_id as string | null | undefined;
    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      const email = user.email || profile?.email;
      if (email) sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error('[stripe/checkout]', e);
    const message = e instanceof Error ? e.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
