const DEFAULT_TAG = 'wist04-20';

/**
 * Appends an Amazon affiliate tag to an Amazon product URL.
 * Uses the user's own tag if set, otherwise falls back to the platform default.
 */
export function affiliateUrl(url: string, userTag?: string | null): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!host.includes('amazon.')) return url;
    const tag = userTag?.trim() || DEFAULT_TAG;
    u.searchParams.set('tag', tag);
    return u.toString();
  } catch {
    return url;
  }
}
