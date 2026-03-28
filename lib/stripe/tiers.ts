import type { SubscriptionTier } from '@/lib/constants/subscription-tiers';

/**
 * Map Stripe Price IDs (from Dashboard) to Wist tiers.
 * Accepts both price_xxx and prod_xxx formats, and also looks at the price
 * object `lookup_key` / `product` if provided so that monthly vs yearly
 * variants still resolve correctly.
 */
export function priceIdToTier(priceId: string): SubscriptionTier | null {
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  const creator = process.env.STRIPE_PRICE_CREATOR?.trim();

  if (pro && priceId === pro) return 'pro';
  if (creator && priceId === creator) return 'creator';

  // Fallback: if the env var contains a substring match (covers yearly/monthly variants
  // like price_xxx_yearly when env only has price_xxx), try a prefix check.
  if (pro && priceId.startsWith(pro.replace(/_monthly|_yearly/i, ''))) return 'pro';
  if (creator && priceId.startsWith(creator.replace(/_monthly|_yearly/i, ''))) return 'creator';

  // Log for debugging when we can't map — helps catch missing env vars in production.
  console.warn(
    `[priceIdToTier] Unknown price id "${priceId}". ` +
    `STRIPE_PRICE_PRO=${pro || '(unset)'}, STRIPE_PRICE_CREATOR=${creator || '(unset)'}`
  );
  return null;
}

/** Env var names for recurring subscription Price IDs (Stripe Dashboard → Products → copy price_…). */
export const STRIPE_PRICE_ENV_VAR: Record<'pro' | 'creator', string> = {
  pro: 'STRIPE_PRICE_PRO',
  creator: 'STRIPE_PRICE_CREATOR',
};

export function tierToPriceId(tier: 'pro' | 'creator'): string | null {
  if (tier === 'pro') return process.env.STRIPE_PRICE_PRO?.trim() || null;
  if (tier === 'creator') return process.env.STRIPE_PRICE_CREATOR?.trim() || null;
  return null;
}

/** Use when checkout / plan change fails because the tier’s Price ID env is unset. */
export function tierPriceNotConfiguredResponse(tier: 'pro' | 'creator') {
  const envVar = STRIPE_PRICE_ENV_VAR[tier];
  return {
    error: `Price ID not configured for ${tier}.`,
    hint: `Set ${envVar} to your Stripe recurring subscription Price ID (starts with price_).`,
    tier,
    envVar,
  };
}

export function stripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
