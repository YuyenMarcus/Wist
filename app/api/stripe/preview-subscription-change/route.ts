import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getStripe } from '@/lib/stripe/server';
import { tierToPriceId, priceIdToTier, tierPriceNotConfiguredResponse } from '@/lib/stripe/tiers';
import { subscriptionGrantsPaidAccess } from '@/lib/stripe/sync-profile';

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

function summarizePreviewInvoice(invoice: Stripe.Invoice) {
  const lines = invoice.lines?.data ?? [];
  return {
    amountDue: invoice.amount_due,
    amountRemaining: invoice.amount_remaining,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    total: invoice.total,
    totalExcludingTax: invoice.total_excluding_tax,
    lineItems: lines.map((line) => ({
      description: line.description ?? null,
      amount: line.amount,
      currency: line.currency,
      proration: Boolean(line.proration),
      quantity: line.quantity ?? 1,
    })),
  };
}

/**
 * Preview proration / next charge when changing the subscription to another Wist tier price.
 * Body: `{ "tier": "pro" | "creator" }` or `{ "priceId": "price_..." }` (must map to Pro/Creator).
 * Customer and subscription IDs are taken from the authenticated user's profile (not trusted from client).
 */
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
      return NextResponse.json({ error: 'No active subscription to preview.' }, { status: 400 });
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
      return NextResponse.json(tierPriceNotConfiguredResponse(targetTier), { status: 503 });
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
        { error: 'Subscription is not in a state that can be previewed.' },
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

    const invoice = await stripe.invoices.createPreview({
      customer: customerId,
      subscription: subscriptionId,
      expand: ['lines.data.price'],
      subscription_details: {
        items: [{ id: firstItem.id, price: newPriceId }],
        proration_behavior: 'create_prorations',
      },
    });

    return NextResponse.json({
      targetTier,
      preview: summarizePreviewInvoice(invoice),
    });
  } catch (e: unknown) {
    console.error('[stripe/preview-subscription-change]', e);
    const message = e instanceof Error ? e.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
