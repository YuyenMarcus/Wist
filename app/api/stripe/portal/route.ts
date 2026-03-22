import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, getAppUrl } from '@/lib/stripe/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function POST() {
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
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    const customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account yet. Subscribe to a plan first.' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const base = getAppUrl();

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/dashboard/subscription`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: unknown) {
    console.error('[stripe/portal]', e);
    const message = e instanceof Error ? e.message : 'Portal failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
