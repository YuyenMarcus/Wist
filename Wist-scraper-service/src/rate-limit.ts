interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const DOMAIN_MIN_INTERVAL = Number(process.env.DOMAIN_MIN_INTERVAL_MS) || 5000; // 5 seconds default

export function checkRateLimit(
  domain: string,
  identifier: string = 'default'
): { allowed: boolean; retryAfter?: number } {
  const key = `${domain}:${identifier}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + DOMAIN_MIN_INTERVAL,
    });
    return { allowed: true };
  }

  // Only allow 1 request per interval window
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
  return { allowed: false, retryAfter };
}

export function clearRateLimit(domain: string, identifier: string = 'default'): void {
  const key = `${domain}:${identifier}`;
  rateLimitStore.delete(key);
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Every minute
