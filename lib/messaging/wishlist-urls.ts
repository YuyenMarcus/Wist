/**
 * Extract real product URLs from Instagram / Messenger webhook messages.
 * Meta often sends lookaside.fbsbx.com (and similar) preview URLs; we resolve redirects
 * and dedupe so one shared link doesn't create 4 queue rows.
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

function isFacebookProxyOrCdnHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes('fbsbx.com') ||
    h.includes('fbcdn.net') ||
    h === 'l.facebook.com' ||
    h === 'lm.facebook.com' ||
    h === 'l.instagram.com' ||
    h === 'lm.instagram.com' ||
    (h.endsWith('.facebook.com') && (h.startsWith('l.') || h.startsWith('lm.')))
  );
}

/** Messenger / IG often use l.facebook.com/l.php?u=https%3A%2F%2F... */
function tryUnwrapFacebookLinkShim(href: string): string | null {
  try {
    const u = new URL(href);
    const h = u.hostname.toLowerCase();
    if (
      h === 'l.facebook.com' ||
      h === 'lm.facebook.com' ||
      h === 'l.instagram.com' ||
      h === 'lm.instagram.com'
    ) {
      const target = u.searchParams.get('u');
      if (target) {
        const decoded = decodeURIComponent(target);
        if (/^https?:\/\//i.test(decoded)) return decoded;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Follow redirects from Meta CDN / link-shim URLs to the real destination.
 */
export async function resolveWishlistUrl(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) return url;

  const shimTarget = tryUnwrapFacebookLinkShim(url);
  if (shimTarget) {
    try {
      if (!isFacebookProxyOrCdnHost(new URL(shimTarget).hostname)) {
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
    return url;
  }

  if (!isFacebookProxyOrCdnHost(parsed.hostname)) {
    return url;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Wist/1.0; +https://wishlist.nuvio.cloud)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(t);
    const final = res.url;
    if (final) {
      try {
        const finalHost = new URL(final).hostname;
        if (!isFacebookProxyOrCdnHost(finalHost)) {
          return final;
        }
      } catch {
        /* keep trying og:url */
      }
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
            !isFacebookProxyOrCdnHost(new URL(candidate).hostname)
          ) {
            return candidate;
          }
        } catch {
          /* skip */
        }
      }
    }
  } catch (e) {
    console.warn('[wishlist-urls] resolveWishlistUrl failed:', url.slice(0, 80), e);
  }
  return url;
}

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
    /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|net|org|io|co|shop|us|uk|eu|de|fr)(?:\/[^\s<>"{}|\\^`\[\],.;:!?)]*)?/gi;
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
      for (const key of ['target_url', 'share_url', 'canonical_url']) {
        add((p as Record<string, unknown>)[key]);
      }
    }
  }
  return [...urls];
}

export type WishlistUrlChannel = 'instagram' | 'messenger';

/**
 * - **messenger**: If the message text already contains http(s) links, ignore attachment preview URLs
 *   (avoids duplicate fbsbx rows for the same pasted link).
 * - **instagram**: Merge text + attachments so “paper plane” shares (often attachment-only previews)
 *   still resolve; dedupe happens after redirect/og:url resolution.
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
    const key = normalizeUrlKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
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
