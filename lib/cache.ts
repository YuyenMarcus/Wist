/**
 * Simple in-memory cache for scraped products
 * For production, replace with Redis or Supabase cache table
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = 12 * 60 * 60 * 1000; // 12 hours

export function getCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    cacheStore.delete(key);
    return null;
  }

  return entry.data;
}

export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  cacheStore.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
}

export function clearCache(key: string): void {
  cacheStore.delete(key);
}

export function generateCacheKey(url: string): string {
  return `scrape:${url}`;
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  cacheStore.forEach((entry, key) => {
    if (entry.expiresAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cacheStore.delete(key));
}, 60 * 60 * 1000); // Every hour
