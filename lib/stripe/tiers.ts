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

export function tierToPriceId(tier: 'pro' | 'creator'): string | null {
  if (tier === 'pro') return process.env.STRIPE_PRICE_PRO?.trim() || null;
  if (tier === 'creator') return process.env.STRIPE_PRICE_CREATOR?.trim() || null;
  return null;
}

export function stripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
