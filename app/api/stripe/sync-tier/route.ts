import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { tryResyncTierFromStripe } from '@/lib/stripe/refresh-tier';
import { getServiceRoleSupabase, hasServiceRoleKey } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

/**
 * Force re-sync the current user's subscription_tier from Stripe.
 * Useful when the webhook missed or env var was misconfigured.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const synced = await tryResyncTierFromStripe(user.id);

    let currentTier = 'free';
    if (hasServiceRoleKey()) {
      const admin = getServiceRoleSupabase();
      const { data } = await admin
        .from('profiles')
        .select('subscription_tier, stripe_subscription_id, stripe_customer_id')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        currentTier = data.subscription_tier || 'free';
      }
    }

    return NextResponse.json({
      ok: true,
      synced,
      tier: currentTier,
    });
  } catch (e: unknown) {
    console.error('[stripe/sync-tier]', e);
    const message = e instanceof Error ? e.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
