import { getItemLimit, type SubscriptionTier } from '@/lib/constants/subscription-tiers';

export interface ItemLimitResult {
  allowed: boolean;
  limit: number | null;
  current: number;
}

export async function checkItemLimit(
  supabase: any,
  userId: string
): Promise<ItemLimitResult> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
  const limit = getItemLimit(tier);

  if (limit === null) {
    return { allowed: true, limit: null, current: 0 };
  }

  const { count } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active');

  return {
    allowed: (count || 0) < limit,
    limit,
    current: count || 0,
  };
}

export function isTierAtLeast(
  userTier: string | null | undefined,
  requiredTier: SubscriptionTier
): boolean {
  const order: SubscriptionTier[] = ['free', 'pro', 'pro_plus', 'creator', 'enterprise'];
  const userIdx = order.indexOf((userTier || 'free') as SubscriptionTier);
  const requiredIdx = order.indexOf(requiredTier);
  return userIdx >= requiredIdx;
}
