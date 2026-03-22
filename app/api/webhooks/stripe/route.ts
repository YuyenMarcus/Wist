import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/server';
import { syncProfileAfterCheckout, syncProfileFromSubscription } from '@/lib/stripe/sync-profile';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error('[stripe webhook] signature verify failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const userId = session.client_reference_id?.trim();
        const customerRaw = session.customer;
        const customerId =
          typeof customerRaw === 'string'
            ? customerRaw
            : customerRaw && 'id' in customerRaw
              ? customerRaw.id
              : null;
        const subRaw = session.subscription;
        const subscriptionId =
          typeof subRaw === 'string' ? subRaw : subRaw && 'id' in subRaw ? subRaw.id : null;

        if (userId && customerId && subscriptionId) {
          const r = await syncProfileAfterCheckout({ userId, stripeCustomerId: customerId, subscriptionId });
          if (!r.ok) console.error('[stripe webhook] checkout.session.completed sync failed', r.error);
        } else {
          console.warn('[stripe webhook] checkout.session.completed missing ids', {
            userId: !!userId,
            customerId: !!customerId,
            subscriptionId: !!subscriptionId,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const r = await syncProfileFromSubscription(sub);
        if (!r.ok && r.error !== 'profile_not_found') {
          console.error('[stripe webhook] subscription.deleted sync failed', r.error);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const stripe = getStripe();
        let full: Stripe.Subscription;
        try {
          full = await stripe.subscriptions.retrieve(sub.id, {
            expand: ['items.data.price'],
          });
        } catch (e) {
          console.warn('[stripe webhook] retrieve subscription failed, using event payload', e);
          full = sub;
        }
        const r = await syncProfileFromSubscription(full);
        if (!r.ok && r.error !== 'profile_not_found') {
          console.error('[stripe webhook] subscription.updated sync failed', r.error);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          const stripe = getStripe();
          try {
            const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] });
            const r = await syncProfileFromSubscription(sub);
            if (!r.ok && r.error !== 'profile_not_found') {
              console.error('[stripe webhook] invoice.payment_succeeded sync failed', r.error);
            }
          } catch (e) {
            console.warn('[stripe webhook] invoice.payment_succeeded retrieve failed', e);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('[stripe webhook] invoice.payment_failed for', invoice.customer);
        break;
      }

      default:
        break;
    }
  } catch (e) {
    console.error('[stripe webhook] handler error', e);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
