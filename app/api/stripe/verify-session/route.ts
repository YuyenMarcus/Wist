import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/server';
import { syncProfileAfterCheckout } from '@/lib/stripe/sync-profile';

export const dynamic = 'force-dynamic';

/**
 * Confirms Checkout after redirect (webhook may be slightly delayed).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.client_reference_id !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to this account' }, { status: 403 });
    }

    if (session.mode !== 'subscription') {
      return NextResponse.json({ error: 'Not a subscription checkout' }, { status: 400 });
    }

    if (session.status !== 'complete') {
      return NextResponse.json({ ok: false, status: session.status }, { status: 200 });
    }

    const customerRaw = session.customer;
    const customerId = typeof customerRaw === 'string' ? customerRaw : customerRaw && 'id' in customerRaw ? customerRaw.id : null;

    const subRaw = session.subscription;
    const subscriptionId =
      typeof subRaw === 'string' ? subRaw : subRaw && 'id' in subRaw ? subRaw.id : null;

    if (!customerId || !subscriptionId) {
      return NextResponse.json({ error: 'Missing customer or subscription on session' }, { status: 422 });
    }

    const result = await syncProfileAfterCheckout({
      userId: user.id,
      stripeCustomerId: customerId,
      subscriptionId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Sync failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('[stripe/verify-session]', e);
    const message = e instanceof Error ? e.message : 'Verify failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
