import Stripe from 'stripe';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error('[Stripe] STRIPE_SECRET_KEY is not set');
    }
    stripe = new Stripe(key);
  }
  return stripe;
}

/** Canonical site URL for redirects (Checkout success/cancel, Customer Portal). */
export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`;
  return 'http://localhost:3000';
}
