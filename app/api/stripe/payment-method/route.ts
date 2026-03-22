import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getStripe } from '@/lib/stripe/server';

export const dynamic = 'force-dynamic';

/** Safe subset for UI — never expose full PAN or CVC. */
function cardSummaryFromPaymentMethod(pm: Stripe.PaymentMethod): {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
} {
  const card = pm.card;
  return {
    id: pm.id,
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
    expMonth: card?.exp_month ?? null,
    expYear: card?.exp_year ?? null,
  };
}

async function resolveDefaultCardForCustomer(
  stripe: Stripe,
  customerId: string,
  subscriptionId: string | null | undefined
): Promise<Stripe.PaymentMethod | null> {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  });

  if (customer.deleted) return null;

  const invPm = customer.invoice_settings?.default_payment_method;
  if (invPm && typeof invPm !== 'string') {
    return invPm;
  }

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method'],
    });
    const dpm = sub.default_payment_method;
    if (dpm && typeof dpm !== 'string') {
      return dpm;
    }
  }

  const list = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  });
  return list.data[0] ?? null;
}

/**
 * GET — resolve default card for the logged-in Stripe customer (no client-supplied PM id).
 * POST — optional body `{ "paymentMethodId": "pm_..." }`; PM must belong to that customer.
 */
export async function GET() {
  return handlePaymentMethodRequest(null);
}

export async function POST(req: Request) {
  let paymentMethodId: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.paymentMethodId === 'string' && body.paymentMethodId.startsWith('pm_')) {
      paymentMethodId = body.paymentMethodId.trim();
    }
  } catch {
    // empty body is OK → same as GET
  }
  return handlePaymentMethodRequest(paymentMethodId);
}

async function handlePaymentMethodRequest(requestedPaymentMethodId: string | null) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) {
      return NextResponse.json({ error: 'Stripe is not configured.' }, { status: 503 });
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
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle();

    const customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return NextResponse.json({ paymentMethod: null });
    }

    const stripe = getStripe();
    let pm: Stripe.PaymentMethod | null = null;

    if (requestedPaymentMethodId) {
      const retrieved = await stripe.paymentMethods.retrieve(requestedPaymentMethodId);
      const pmCustomer =
        typeof retrieved.customer === 'string' ? retrieved.customer : retrieved.customer?.id ?? null;
      if (pmCustomer !== customerId) {
        return NextResponse.json({ error: 'Payment method does not belong to this account.' }, { status: 403 });
      }
      pm = retrieved;
    } else {
      pm = await resolveDefaultCardForCustomer(
        stripe,
        customerId,
        profile?.stripe_subscription_id as string | null | undefined
      );
    }

    if (!pm || pm.type !== 'card') {
      return NextResponse.json({ paymentMethod: null });
    }

    return NextResponse.json({ paymentMethod: cardSummaryFromPaymentMethod(pm) });
  } catch (e: unknown) {
    console.error('[stripe/payment-method]', e);
    const message = e instanceof Error ? e.message : 'Failed to load payment method';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
