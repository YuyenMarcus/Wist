/**
 * Extract real product URLs from Instagram / Messenger webhook messages.
 *
 * Meta sends several kinds of URLs in DM webhooks:
 *   1. `l.facebook.com` / `l.instagram.com` link shims  → unwrap `?u=` param
 *   2. `lookaside.fbsbx.com/ig_messaging_cdn`           → CDN image preview (NEVER a product link)
 *   3. `scontent*.fbcdn.net`                             → CDN image (NEVER a product link)
 *   4. `instagram.com/p/…` or `instagram.com/reel/…`    → IG post, may contain external product link
 *   5. Direct product URLs                               → pass through
 *
 * We resolve (1), discard (2)+(3), try to extract external links from (4), and keep (5).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igshid',
  'ig_rid',
]);

/** Normalize for deduplication (not for display). */
export function normalizeUrlKey(href: string): string {
  try {
    const u = new URL(href.trim());
    u.hash = '';
    TRACKING_PARAMS.forEach((k) => u.searchParams.delete(k));
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}`;
  } catch {
    return href.trim();
  }
}

// ── Host classification helpers ──

/** Link shim / redirect hosts where `?u=` contains the real URL. */
function isMetaLinkShim(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'l.facebook.com' ||
    h === 'lm.facebook.com' ||
    h === 'l.instagram.com' ||
    h === 'lm.instagram.com'
  );
}

/** CDN hosts that serve images/video — never product links. Must be discarded. */
function isMetaCdnHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes('lookaside.fbsbx.com') ||
    h.includes('fbsbx.com') ||
    h.includes('fbcdn.net') ||
    h.includes('cdninstagram.com') ||
    h.includes('xx.fbcdn')
  );
}

/** Any Facebook/Instagram-controlled host (CDN + redirectors). */
function isMetaInternalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    isMetaCdnHost(h) ||
    isMetaLinkShim(h) ||
    h === 'facebook.com' ||
    h === 'www.facebook.com' ||
    h === 'fb.com' ||
    h === 'm.facebook.com' ||
    h === 'web.facebook.com'
  );
}

/** True for instagram.com post/reel/tv URLs that may contain an external product link. */
function isInstagramContentUrl(hostname: string, pathname: string): boolean {
  const h = hostname.toLowerCase();
  if (h !== 'instagram.com' && h !== 'www.instagram.com') return false;
  return /^\/(p|reel|tv|reels)\/[A-Za-z0-9_-]+/i.test(pathname);
}

// ── Unwrap helpers ──

/** Unwrap `l.facebook.com/l.php?u=…` and `l.instagram.com/?u=…` shims. */
function tryUnwrapLinkShim(href: string): string | null {
  try {
    const u = new URL(href);
    if (!isMetaLinkShim(u.hostname)) return null;
    const target = u.searchParams.get('u');
    if (target) {
      const decoded = decodeURIComponent(target);
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Extract `asset_id` from lookaside CDN URLs for Graph API lookup. */
function extractCdnAssetId(href: string): string | null {
  try {
    const u = new URL(href);
    return u.searchParams.get('asset_id') || null;
  } catch {
    return null;
  }
}

// ── Graph API helpers ──

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Try to get the external link from an Instagram media by its asset / media ID.
 * Returns the ad's CTA URL or the link attached to the post, if any.
 */
async function resolveAssetIdViaGraphApi(assetId: string): Promise<string | null> {
  const token =
    process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
    process.env.PAGE_ACCESS_TOKEN?.trim();
  if (!token) return null;

  try {
    const url = `${GRAPH_BASE}/${encodeURIComponent(assetId)}?fields=permalink,link,caption&access_token=${encodeURIComponent(token)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[wishlist-urls] Graph API asset ${assetId} returned ${res.status}`);
      return null;
    }

    const data = await res.json();

    // `link` is the external URL attached to the post (ad CTA, swipe-up, etc.)
    if (data.link && /^https?:\/\//i.test(data.link)) {
      const linkHost = new URL(data.link).hostname;
      if (!isMetaCdnHost(linkHost) && !isMetaLinkShim(linkHost)) {
        console.log(`[wishlist-urls] Graph API resolved asset ${assetId} → ${data.link}`);
        return data.link;
      }
      const unwrapped = tryUnwrapLinkShim(data.link);
      if (unwrapped) return unwrapped;
    }

    // Fallback: try to find URLs in the caption
    if (data.caption) {
      const captionText = typeof data.caption === 'string' ? data.caption : data.caption?.text;
      if (captionText) {
        const captionUrls = extractHttpsUrlsFromText(captionText);
        for (const cu of captionUrls) {
          try {
            const h = new URL(cu).hostname;
            if (!isMetaCdnHost(h) && !isMetaInternalHost(h) && !h.includes('instagram.com')) return cu;
          } catch { /* skip */ }
        }
      }
    }

    // Fallback: return permalink (the instagram.com/p/... URL) so we can try HTML extraction
    if (data.permalink && /^https?:\/\//i.test(data.permalink)) {
      return data.permalink;
    }
  } catch (e) {
    console.warn(`[wishlist-urls] Graph API asset lookup failed for ${assetId}:`, e);
  }
  return null;
}

/**
 * For instagram.com/p/... or /reel/... URLs: fetch the IG page and try to find
 * the external product link (ad CTA, bio link in caption, og:see_also, etc.).
 */
async function resolveInstagramPostToExternalUrl(igUrl: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(igUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timer);

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;

    const html = (await res.text()).slice(0, 500_000);

    const externalUrls: string[] = [];

    // 1. og:see_also meta tag (sometimes has the product URL)
    const ogSeeAlso =
      html.match(/property=["']og:see_also["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:see_also["']/i);
    if (ogSeeAlso?.[1]) externalUrls.push(ogSeeAlso[1].replace(/&amp;/g, '&').trim());

    // 2. "link" field in JSON-LD or embedded data (ad CTA URLs)
    const linkMatches = html.matchAll(/"link"\s*:\s*"(https?:\/\/[^"]+)"/gi);
    for (const lm of linkMatches) {
      externalUrls.push(lm[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
    }

    // 3. Caption URLs from JSON data
    const captionMatch = html.match(/"caption"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"edge_media_to_caption".*?"text"\s*:\s*"([^"]+)"/i);
    if (captionMatch?.[1]) {
      const decoded = captionMatch[1].replace(/\\n/g, ' ').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
      externalUrls.push(...extractHttpsUrlsFromText(decoded));
    }

    // 4. Explicit external_url or cta_url fields
    const ctaMatches = html.matchAll(/"(?:external_url|cta_url|website|link_url)"\s*:\s*"(https?:\/\/[^"]+)"/gi);
    for (const cm of ctaMatches) {
      externalUrls.push(cm[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
    }

    // Pick the first non-Meta URL we find
    for (const raw of externalUrls) {
      const unwrapped = tryUnwrapLinkShim(raw) || raw;
      try {
        const h = new URL(unwrapped).hostname;
        if (!isMetaCdnHost(h) && !isMetaInternalHost(h) && !h.includes('instagram.com')) {
          console.log(`[wishlist-urls] Extracted external URL from IG post: ${unwrapped}`);
          return unwrapped;
        }
      } catch { /* skip invalid URLs */ }
    }
  } catch (e) {
    console.warn('[wishlist-urls] resolveInstagramPostToExternalUrl failed:', e);
  }
  return null;
}

// ── Main resolution ──

/**
 * Resolve a single URL from a webhook message to its real product destination.
 * Returns `null` if the URL is a dead-end CDN image that can't be resolved.
 */
export async function resolveWishlistUrl(url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;

  // Step 1: Unwrap link shims (l.facebook.com/?u=…)
  const shimTarget = tryUnwrapLinkShim(url);
  if (shimTarget) {
    try {
      const host = new URL(shimTarget).hostname;
      if (!isMetaCdnHost(host) && !isMetaLinkShim(host)) {
        return shimTarget;
      }
      url = shimTarget;
    } catch {
      return shimTarget;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Step 2: CDN image URLs — never follow, try Graph API instead
  if (isMetaCdnHost(parsed.hostname)) {
    console.log(`[wishlist-urls] CDN URL detected, attempting Graph API: ${url.slice(0, 100)}`);
    const assetId = extractCdnAssetId(url);
    if (assetId) {
      const resolved = await resolveAssetIdViaGraphApi(assetId);
      if (resolved) {
        // If Graph API returned an IG post URL, try to extract the product link from it
        try {
          const resolvedParsed = new URL(resolved);
          if (isInstagramContentUrl(resolvedParsed.hostname, resolvedParsed.pathname)) {
            const external = await resolveInstagramPostToExternalUrl(resolved);
            return external || resolved;
          }
        } catch { /* use resolved as-is */ }
        return resolved;
      }
    }
    console.warn(`[wishlist-urls] Could not resolve CDN URL, discarding: ${url.slice(0, 100)}`);
    return null;
  }

  // Step 3: Instagram post/reel URLs — try to extract the external product link
  if (isInstagramContentUrl(parsed.hostname, parsed.pathname)) {
    console.log(`[wishlist-urls] Instagram content URL, trying to extract product link: ${url}`);
    const external = await resolveInstagramPostToExternalUrl(url);
    if (external) return external;
    return url;
  }

  // Step 4: Other Meta internal hosts — follow redirects
  if (isMetaInternalHost(parsed.hostname)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(t);

      const final = res.url;
      if (final) {
        try {
          const finalHost = new URL(final).hostname;
          if (!isMetaCdnHost(finalHost) && !isMetaInternalHost(finalHost)) {
            return final;
          }
        } catch { /* keep trying og:url */ }
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('text/html')) {
        const html = (await res.text()).slice(0, 200_000);
        const og =
          html.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i) ||
          html.match(/content=["']([^"']+)["'][^>]*property=["']og:url["']/i);
        if (og?.[1]) {
          const candidate = og[1].replace(/&amp;/g, '&').trim();
          try {
            if (
              /^https?:\/\//i.test(candidate) &&
              !isMetaCdnHost(new URL(candidate).hostname) &&
              !isMetaInternalHost(new URL(candidate).hostname)
            ) {
              return candidate;
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.warn('[wishlist-urls] redirect follow failed:', url.slice(0, 80), e);
    }
    return null;
  }

  // Step 5: Non-Meta URL — it's already a product link
  return url;
}

// ── Text extraction ──

function extractHttpsUrlsFromText(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, '')))];
}

/** e.g. gohaus.com/foo when user didn't include https:// */
function extractBareDomainsFromText(text: string): string[] {
  if (!text.trim()) return [];
  if (/https?:\/\//i.test(text)) return [];

  const re =
    /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|net|org|io|co|shop|us|uk|eu|de|fr|es|it|ca|au|jp|in)(?:\/[^\s<>"{}|\\^`\[\],.;:!?)]*)?/gi;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].replace(/[.,;:!?)]+$/, '').toLowerCase();
    if (seen.has(raw)) continue;
    if (raw.includes('@')) continue;
    seen.add(raw);
    out.push(`https://${m[0].replace(/[.,;:!?)]+$/, '')}`);
  }
  return out;
}

// ── Attachment extraction ──

function extractUrlsFromAttachments(message: any): string[] {
  const urls = new Set<string>();
  function add(u: unknown) {
    if (typeof u !== 'string' || !/^https?:\/\//i.test(u)) return;
    urls.add(u.replace(/[.,;:!?)]+$/, ''));
  }

  if (!Array.isArray(message?.attachments)) return [];

  for (const attachment of message.attachments) {
    add(attachment?.payload?.url);
    add(attachment?.url);

    const p = attachment?.payload;
    if (p && typeof p === 'object') {
      for (const key of [
        'target_url', 'share_url', 'canonical_url',
        'link', 'web_url', 'fallback_url', 'title_link', 'item_url',
      ]) {
        add((p as Record<string, unknown>)[key]);
      }

      // Some shares nest URLs in fallback arrays
      if (Array.isArray((p as any).fallback)) {
        for (const fb of (p as any).fallback) {
          add(fb?.url);
          add(fb?.link);
        }
      }
    }
  }
  return [...urls];
}

export type WishlistUrlChannel = 'instagram' | 'messenger';

/**
 * Main entry point: extract and resolve all product URLs from a webhook message.
 *
 * - **messenger**: If the message text already contains http(s) links, ignore attachment preview URLs.
 * - **instagram**: Merge text + attachments so paper-plane shares still resolve.
 *
 * CDN image URLs that can't be resolved are filtered out entirely.
 */
export async function extractResolvedWishlistUrls(
  message: any,
  options?: { source?: WishlistUrlChannel }
): Promise<string[]> {
  const source: WishlistUrlChannel = options?.source ?? 'messenger';
  const text = typeof message?.text === 'string' ? message.text : '';
  const fromHttps = extractHttpsUrlsFromText(text);
  const fromBare = extractBareDomainsFromText(text);
  const fromText = [...new Set([...fromHttps, ...fromBare])];
  const fromAttachments = extractUrlsFromAttachments(message);

  console.log(`[wishlist-urls] source=${source} fromText=[${fromText.map(u => u.slice(0, 60)).join(', ')}] fromAttachments=[${fromAttachments.map(u => u.slice(0, 60)).join(', ')}]`);

  let candidates: string[];
  if (source === 'instagram') {
    candidates = [...new Set([...fromText, ...fromAttachments])];
  } else if (fromText.length > 0) {
    candidates = fromText;
  } else {
    candidates = fromAttachments;
  }

  const resolved = await Promise.all(candidates.map((u) => resolveWishlistUrl(u)));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of resolved) {
    if (!r) continue;

    // Final safety: never save a CDN URL
    try {
      if (isMetaCdnHost(new URL(r).hostname)) {
        console.warn(`[wishlist-urls] Dropping unresolved CDN URL from final output: ${r.slice(0, 80)}`);
        continue;
      }
    } catch { /* skip invalid */ }

    const key = normalizeUrlKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  console.log(`[wishlist-urls] Final resolved URLs: [${out.map(u => u.slice(0, 80)).join(', ')}]`);
  return out;
}

/** Avoid duplicate queued rows when Meta retries webhooks or sends multiple attachment URLs. */
export async function isDuplicateQueuedUrl(
  supabase: SupabaseClient,
  userId: string,
  url: string,
  windowMinutes = 20
): Promise<boolean> {
  const key = normalizeUrlKey(url);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('items')
    .select('url')
    .eq('user_id', userId)
    .eq('status', 'queued')
    .gte('created_at', since)
    .limit(80);

  return (data ?? []).some((row) => normalizeUrlKey(row.url || '') === key);
}
