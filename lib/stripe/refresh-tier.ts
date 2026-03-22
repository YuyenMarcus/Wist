import { getStripe } from '@/lib/stripe/server';
import { syncProfileFromSubscription } from '@/lib/stripe/sync-profile';
import { getServiceRoleSupabase, hasServiceRoleKey } from '@/lib/supabase/service-role';

/**
 * If the profile has a Stripe subscription id, pull the latest subscription from Stripe
 * and sync `subscription_tier` (and related columns). Use when DB tier may be stale
 * (e.g. webhook delay) so paid users are not stuck on the free item cap.
 */
export async function tryResyncTierFromStripe(userId: string): Promise<boolean> {
  if (!hasServiceRoleKey()) return false;
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return false;

  try {
    const admin = getServiceRoleSupabase();
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .maybeSingle();

    const subId =
      typeof profile?.stripe_subscription_id === 'string'
        ? profile.stripe_subscription_id.trim()
        : '';
    if (!subId.startsWith('sub_')) return false;

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['items.data.price'],
    });

    const { ok } = await syncProfileFromSubscription(sub);
    return ok;
  } catch (e) {
    console.warn('[tryResyncTierFromStripe] failed:', e);
    return false;
  }
}
