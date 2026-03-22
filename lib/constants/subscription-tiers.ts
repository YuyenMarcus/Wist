export type SubscriptionTier = 'free' | 'pro' | 'creator' | 'enterprise';

export interface TierConfig {
  key: SubscriptionTier;
  name: string;
  displayName: string;
  price: number | null;
  priceLabel: string;
  itemLimit: number | null;
  collectionLimit: number | null;
  frequency: 'weekly' | 'daily' | 'instant';
  intervalMs: number;
  badgeColor: string;
  features: string[];
}

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    key: 'free',
    name: 'Free',
    displayName: 'Wist Free',
    price: 0,
    priceLabel: '$0',
    itemLimit: 100,
    collectionLimit: 10,
    frequency: 'weekly',
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    badgeColor: 'zinc',
    features: [
      '100 items in dashboard',
      '10 collections',
      'Weekly price checks',
      'Price drop notifications (weekly)',
      'Browser extension',
      'Price history graph',
      'Share your wishlist',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    displayName: 'Wist Pro',
    price: 8,
    priceLabel: '$8/mo',
    itemLimit: null,
    collectionLimit: null,
    frequency: 'daily',
    intervalMs: 24 * 60 * 60 * 1000,
    badgeColor: 'violet',
    features: [
      'Unlimited items & collections',
      'Daily price checks',
      'Back-in-stock alerts by variant',
      'Similar product comparison',
      'Smart auto-categorization',
      '2-year price history',
      'Gifting service',
      'Amazon & spreadsheet sync',
      'Multi-currency support',
    ],
  },
  creator: {
    key: 'creator',
    name: 'Creator',
    displayName: 'Wist Creator',
    price: 15,
    priceLabel: '$15/mo',
    itemLimit: null,
    collectionLimit: null,
    frequency: 'instant',
    intervalMs: 0,
    badgeColor: 'amber',
    features: [
      'Everything in Pro',
      '6-hour price checks',
      'Profile customization',
      'Community analytics',
      'Creator badge on profile',
      'Priority support',
    ],
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    displayName: 'Wist Enterprise',
    price: null,
    priceLabel: 'Custom',
    itemLimit: null,
    collectionLimit: null,
    frequency: 'instant',
    intervalMs: 0,
    badgeColor: 'emerald',
    features: [
      'Everything in Creator',
      'Dedicated support',
      'API access',
      'Team/org wishlists',
      'Bulk gifting',
      'Custom branding',
    ],
  },
} as const;

export const TIER_ORDER: SubscriptionTier[] = ['free', 'pro', 'creator', 'enterprise'];

export const NOTIFICATION_TIERS = TIERS;

export function canSendNotification(
  tier: SubscriptionTier,
  lastNotificationSent: Date | null
): boolean {
  const tierConfig = TIERS[tier];
  if (tierConfig.frequency === 'instant') return true;
  if (!lastNotificationSent) return true;

  const now = new Date();
  const elapsed = now.getTime() - lastNotificationSent.getTime();
  return elapsed >= tierConfig.intervalMs;
}

export function getNextNotificationTime(
  tier: SubscriptionTier,
  lastNotificationSent: Date | null
): Date {
  const tierConfig = TIERS[tier];
  const now = new Date();

  if (!lastNotificationSent) return now;
  if (tierConfig.frequency === 'instant') return now;

  const nextTime = new Date(lastNotificationSent.getTime() + tierConfig.intervalMs);
  return nextTime > now ? nextTime : now;
}

export function getItemLimit(tier: SubscriptionTier): number | null {
  return TIERS[tier]?.itemLimit ?? TIERS.free.itemLimit;
}

export function getCollectionLimit(tier: SubscriptionTier): number | null {
  return TIERS[tier]?.collectionLimit ?? TIERS.free.collectionLimit;
}

export function getTierDisplayName(tier: SubscriptionTier): string {
  return TIERS[tier]?.displayName || 'Wist Free';
}
