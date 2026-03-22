import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getStripe } from '@/lib/stripe/server';
import { tierToPriceId, priceIdToTier } from '@/lib/stripe/tiers';
import { syncProfileFromSubscription, subscriptionGrantsPaidAccess } from '@/lib/stripe/sync-profile';

export const dynamic = 'force-dynamic';

function primaryPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

function subscriptionCustomerId(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (typeof c === 'string') return c;
  if (c && 'id' in c) return c.id;
  return null;
}

export async function POST(req: Request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) {
      return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
    }

    let body: { tier?: unknown; priceId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getServiceRoleSupabase();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.subscription_tier === 'enterprise') {
      return NextResponse.json({ error: 'Enterprise billing is managed separately.' }, { status: 403 });
    }

    const customerId = profile?.stripe_customer_id as string | null | undefined;
    const subscriptionId = profile?.stripe_subscription_id as string | null | undefined;
    if (!customerId || !subscriptionId) {
      return NextResponse.json({ error: 'No active subscription to update.' }, { status: 400 });
    }

    let targetTier: 'pro' | 'creator';
    if (body.tier === 'pro' || body.tier === 'creator') {
      targetTier = body.tier;
    } else if (typeof body.priceId === 'string' && body.priceId.trim()) {
      const mapped = priceIdToTier(body.priceId.trim());
      if (mapped !== 'pro' && mapped !== 'creator') {
        return NextResponse.json({ error: 'Invalid price ID.' }, { status: 400 });
      }
      targetTier = mapped;
    } else {
      return NextResponse.json(
        { error: 'Provide tier ("pro" | "creator") or a valid Stripe priceId.' },
        { status: 400 }
      );
    }

    const newPriceId = tierToPriceId(targetTier);
    if (!newPriceId) {
      return NextResponse.json({ error: 'Stripe price not configured for that tier.' }, { status: 503 });
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });

    if (subscriptionCustomerId(subscription) !== customerId) {
      return NextResponse.json({ error: 'Subscription does not belong to this account.' }, { status: 403 });
    }

    if (!subscriptionGrantsPaidAccess(subscription.status)) {
      return NextResponse.json(
        { error: 'Subscription is not in a state that can be updated.' },
        { status: 400 }
      );
    }

    const firstItem = subscription.items.data[0];
    if (!firstItem?.id) {
      return NextResponse.json({ error: 'Subscription has no billable items.' }, { status: 400 });
    }

    const currentPriceId = primaryPriceId(subscription);
    if (currentPriceId === newPriceId) {
      return NextResponse.json({ error: 'Already on this plan.' }, { status: 400 });
    }

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      items: [{ id: firstItem.id, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });

    const updated = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });

    const sync = await syncProfileFromSubscription(updated);
    if (!sync.ok) {
      console.error('[stripe/update-subscription] sync after update failed', sync.error);
    }

    const priceAfter = primaryPriceId(updated);
    const tierAfter = (priceAfter ? priceIdToTier(priceAfter) : null) ?? targetTier;

    return NextResponse.json({ ok: true, tier: tierAfter });
  } catch (e: unknown) {
    console.error('[stripe/update-subscription]', e);
    const message = e instanceof Error ? e.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
