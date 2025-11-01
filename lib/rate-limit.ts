/**
 * Simple in-memory rate limiter per domain
 * For production, replace with Redis-based rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX = 1; // 1 request per window per domain

export function checkRateLimit(
  domain: string,
  identifier: string = 'default'
): { allowed: boolean; retryAfter?: number } {
  const key = `${domain}:${identifier}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new entry or reset expired one
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true };
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
