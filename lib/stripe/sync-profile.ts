import type Stripe from 'stripe';
import type { SubscriptionTier } from '@/lib/constants/subscription-tiers';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { priceIdToTier } from '@/lib/stripe/tiers';
import { getStripe } from '@/lib/stripe/server';

function subscriptionPrimaryPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

function customerIdString(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string | null {
  if (typeof customer === 'string') return customer;
  if (customer && 'deleted' in customer && customer.deleted) return null;
  if (customer && 'id' in customer) return customer.id;
  return null;
}

export function subscriptionGrantsPaidAccess(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due' || status === 'paused';
}

/**
 * Resolve profile id from Stripe customer + subscription metadata fallback.
 */
async function resolveUserIdForCustomer(
  stripeCustomerId: string,
  subscription?: Stripe.Subscription | null
): Promise<string | null> {
  const supabase = getServiceRoleSupabase();

  const { data: byCustomer } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (byCustomer?.id) return byCustomer.id;

  const fromMeta = subscription?.metadata?.supabase_user_id?.trim();
  if (fromMeta) return fromMeta;

  return null;
}

export async function syncProfileFromSubscription(sub: Stripe.Subscription): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const stripeCustomerId = customerIdString(sub.customer);
  if (!stripeCustomerId) {
    return { ok: false, error: 'missing_customer' };
  }

  const userId = await resolveUserIdForCustomer(stripeCustomerId, sub);
  if (!userId) {
    return { ok: false, error: 'profile_not_found' };
  }

  const supabase = getServiceRoleSupabase();

  const { data: existing } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const preserveEnterprise = existing?.subscription_tier === 'enterprise';

  let tier: SubscriptionTier = 'free';
  if (!preserveEnterprise) {
    if (subscriptionGrantsPaidAccess(sub.status)) {
      const priceId = subscriptionPrimaryPriceId(sub);
      if (priceId) {
        const mapped = priceIdToTier(priceId);
        if (mapped) {
          tier = mapped;
        } else {
          // Active subscription but unknown price — keep existing paid tier instead
          // of wrongly downgrading to free.
          const current = existing?.subscription_tier as SubscriptionTier | undefined;
          if (current && current !== 'free') {
            console.warn(
              `[stripe] syncProfileFromSubscription: price id "${priceId}" not mapped. ` +
              `Preserving existing tier "${current}" for user ${userId}.`
            );
            tier = current;
          } else {
            // Best effort: treat any unrecognized active subscription as pro
            console.warn(
              `[stripe] syncProfileFromSubscription: price id "${priceId}" not mapped and no existing paid tier. Defaulting to "pro".`
            );
            tier = 'pro';
          }
        }
      }
    }
  } else {
    tier = 'enterprise';
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: sub.id,
      subscription_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[stripe] syncProfileFromSubscription update failed', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, userId };
}

/**
 * Called after Checkout completes (webhook or verify-session) when we know the Supabase user id.
 */
export async function syncProfileAfterCheckout(params: {
  userId: string;
  stripeCustomerId: string;
  subscriptionId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId, {
    expand: ['items.data.price'],
  });

  const supabase = getServiceRoleSupabase();
  const { data: existing } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', params.userId)
    .single();

  const preserveEnterprise = existing?.subscription_tier === 'enterprise';

  const tierFromPrice = subscriptionPrimaryPriceId(sub);
  const mappedTier = tierFromPrice ? priceIdToTier(tierFromPrice) : null;
  let effectiveTier: SubscriptionTier = 'free';
  if (subscriptionGrantsPaidAccess(sub.status)) {
    if (mappedTier) {
      effectiveTier = mappedTier;
    } else {
      // Unknown price on an active sub after checkout — default to pro rather than free
      console.warn(
        `[stripe] syncProfileAfterCheckout: price "${tierFromPrice}" not mapped. Defaulting to "pro".`
      );
      effectiveTier = 'pro';
    }
  }
  if (preserveEnterprise) effectiveTier = 'enterprise';

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.subscriptionId,
      subscription_tier: effectiveTier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.userId);

  if (error) {
    console.error('[stripe] syncProfileAfterCheckout failed', error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
