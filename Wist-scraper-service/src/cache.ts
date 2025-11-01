interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = Number(process.env.CACHE_TTL_MS) || 6 * 60 * 60 * 1000; // 6 hours default

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

export function generateCacheKey(url: string): string {
  try {
    const normalized = new URL(url).href.toLowerCase().replace(/\/$/, '');
    return `scrape:${normalized}`;
  } catch {
    return `scrape:${url}`;
  }
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt < now) {
      cacheStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Every hour
