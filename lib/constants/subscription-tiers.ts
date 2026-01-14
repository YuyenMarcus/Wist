/**
 * Subscription tier definitions and notification frequency logic
 */

export type SubscriptionTier = 'free' | 'pro' | 'creator';

export interface TierConfig {
  name: string;
  frequency: 'weekly' | 'daily' | 'instant';
  intervalMs: number;
}

export const NOTIFICATION_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: 'Free',
    frequency: 'weekly', // Once per week
    intervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  pro: {
    name: 'Pro',
    frequency: 'daily', // Once per 24 hours
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
  },
  creator: {
    name: 'Creator',
    frequency: 'instant', // Real-time
    intervalMs: 0, // No delay
  },
} as const;

/**
 * Check if a notification can be sent based on tier and last notification time
 */
export function canSendNotification(
  tier: SubscriptionTier,
  lastNotificationSent: Date | null
): boolean {
  const tierConfig = NOTIFICATION_TIERS[tier];

  // Creator tier: always allow (instant notifications)
  if (tier === 'creator') {
    return true;
  }

  // If no previous notification, allow
  if (!lastNotificationSent) {
    return true;
  }

  // Check if enough time has passed since last notification
  const now = new Date();
  const timeSinceLastNotification = now.getTime() - lastNotificationSent.getTime();

  return timeSinceLastNotification >= tierConfig.intervalMs;
}

/**
 * Get the next notification time for a tier
 */
export function getNextNotificationTime(
  tier: SubscriptionTier,
  lastNotificationSent: Date | null
): Date {
  const tierConfig = NOTIFICATION_TIERS[tier];
  const now = new Date();

  if (!lastNotificationSent) {
    return now; // Can send immediately
  }

  if (tier === 'creator') {
    return now; // Always immediate
  }

  const nextTime = new Date(lastNotificationSent.getTime() + tierConfig.intervalMs);
  return nextTime > now ? nextTime : now;
}
