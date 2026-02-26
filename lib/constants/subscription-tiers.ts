export type SubscriptionTier = 'free' | 'pro' | 'pro_plus' | 'creator' | 'enterprise';

export interface TierConfig {
  key: SubscriptionTier;
  name: string;
  displayName: string;
  price: number | null; // null = custom pricing
  priceLabel: string;
  itemLimit: number | null; // null = unlimited
  collectionLimit: number | null; // null = unlimited
  frequency: 'weekly' | 'daily' | 'instant';
  intervalMs: number;
  badgeColor: string; // tailwind color prefix
  features: string[];
}

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    key: 'free',
    name: 'Free',
    displayName: 'Wist Free',
    price: 0,
    priceLabel: '$0',
    itemLimit: 20,
    collectionLimit: 5,
    frequency: 'weekly',
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    badgeColor: 'zinc',
    features: [
      '20 items in dashboard',
      '5 collections',
      'Weekly price checks',
      'Basic dashboard',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    displayName: 'Wist+',
    price: 5,
    priceLabel: '$5/mo',
    itemLimit: 45,
    collectionLimit: null,
    frequency: 'daily',
    intervalMs: 24 * 60 * 60 * 1000,
    badgeColor: 'blue',
    features: [
      '45 items in dashboard',
      'Daily price notifications',
      'Back-in-stock detection & alerts',
      'No ads',
      'Similar products price comparison',
    ],
  },
  pro_plus: {
    key: 'pro_plus',
    name: 'Pro+',
    displayName: 'Wist Pro',
    price: 10,
    priceLabel: '$10/mo',
    itemLimit: null,
    collectionLimit: null,
    frequency: 'daily',
    intervalMs: 24 * 60 * 60 * 1000,
    badgeColor: 'violet',
    features: [
      'Unlimited items',
      'Daily price checks',
      'Everything in Wist+',
      'Receipt & warranty tracking',
      '2-year pricing history',
      'Gifting service',
      'External wishlist syncs (Amazon, spreadsheets)',
      'Pro+ badge on profile',
    ],
  },
  creator: {
    key: 'creator',
    name: 'Creator',
    displayName: 'Wist Creator',
    price: 30,
    priceLabel: '$30/mo',
    itemLimit: null,
    collectionLimit: null,
    frequency: 'instant',
    intervalMs: 0,
    badgeColor: 'amber',
    features: [
      'Everything in Wist Pro',
      'Instant price notifications',
      'Boosted audience reach',
      'Community analytics',
      'Profile customization (background, typography, colors)',
      'Creator badge on profile',
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
      'Everything in Wist Creator',
      'Dedicated support',
      'API access',
      'Team/org wishlists',
      'Bulk gifting',
      'Custom branding',
    ],
  },
} as const;

export const TIER_ORDER: SubscriptionTier[] = ['free', 'pro', 'pro_plus', 'creator', 'enterprise'];

// Backward-compatible aliases
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
  return TIERS[tier].itemLimit;
}

export function getCollectionLimit(tier: SubscriptionTier): number | null {
  return TIERS[tier].collectionLimit;
}

export function getTierDisplayName(tier: SubscriptionTier): string {
  return TIERS[tier]?.displayName || 'Wist Free';
}
