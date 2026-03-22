const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

function getAccessToken(): string {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('INSTAGRAM_ACCESS_TOKEN not configured');
  return token;
}

/** User Profile / follow check: Meta docs prefer Page access token; fall back to IG token. */
function getTokenForUserProfile(): string | null {
  return (
    process.env.PAGE_ACCESS_TOKEN?.trim() ||
    process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
    null
  );
}

export type InstagramFollowStatus = 'follows' | 'not_following' | 'unknown';

/**
 * Whether this DM sender follows your Instagram business (Meta User Profile API).
 * Requires instagram_manage_messages + related Page permissions; see Meta docs.
 */
export async function getInstagramDmUserFollowStatus(igsid: string): Promise<InstagramFollowStatus> {
  const token = getTokenForUserProfile();
  if (!token) {
    console.warn('[Instagram] No PAGE_ACCESS_TOKEN / INSTAGRAM_ACCESS_TOKEN for follow check');
    return 'unknown';
  }
  try {
    const url = `${GRAPH_API_BASE}/${encodeURIComponent(igsid)}?fields=is_user_follow_business&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const raw = await res.text();
    if (!res.ok) {
      console.warn(`[Instagram] follow check HTTP ${res.status}:`, raw.slice(0, 280));
      return 'unknown';
    }
    const data = JSON.parse(raw) as { is_user_follow_business?: boolean };
    if (typeof data.is_user_follow_business === 'boolean') {
      return data.is_user_follow_business ? 'follows' : 'not_following';
    }
    return 'unknown';
  } catch (err) {
    console.warn('[Instagram] follow check error:', err);
    return 'unknown';
  }
}

/** @ handle shown in DMs when asking users to follow (no @ prefix in env). */
export function getInstagramBusinessHandleForCopy(): string {
  const h =
    process.env.INSTAGRAM_BUSINESS_USERNAME?.trim() ||
    process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME?.trim() ||
    '';
  return h.replace(/^@/, '');
}

/**
 * Resolve an Instagram-Scoped User ID (IGSID) to a username.
 */
export async function getUsername(igsid: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${igsid}?fields=name,username&access_token=${getAccessToken()}`
    );
    const raw = await res.text();
    if (!res.ok) {
      console.error(`[Instagram] getUsername failed (${res.status}) for IGSID ${igsid}:`, raw);
      return null;
    }
    const data = JSON.parse(raw);
    return data.username || null;
  } catch (err) {
    console.error('[Instagram] getUsername error:', err);
    return null;
  }
}

/**
 * Send a DM reply to an Instagram user via the Send API.
 * Token in URL per Meta's recommended format.
 */
export async function sendReply(recipientId: string, text: string): Promise<boolean> {
  const token = getAccessToken();
  try {
    const url = `${GRAPH_API_BASE}/me/messages?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[Instagram] sendReply failed (${res.status}):`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Instagram] sendReply error:', err);
    return false;
  }
}

/**
 * Extract all URLs from an Instagram webhook message object.
 * Checks both message.text (regex) and message.attachments (payload.url).
 */
export function extractUrlsFromMessage(message: any): string[] {
  const urls = new Set<string>();

  if (message?.text) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const matches = message.text.match(urlRegex);
    if (matches) {
      for (const url of matches) {
        urls.add(url.replace(/[.,;:!?)]+$/, ''));
      }
    }
  }

  if (Array.isArray(message?.attachments)) {
    for (const attachment of message.attachments) {
      if (attachment?.payload?.url) {
        urls.add(attachment.payload.url);
      }
      if (attachment?.type === 'share' && attachment?.payload?.url) {
        urls.add(attachment.payload.url);
      }
    }
  }

  return Array.from(urls);
}

/**
 * Determine if a URL is a direct product link (not an Instagram post).
 */
export function isProductUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const igHosts = ['instagram.com', 'www.instagram.com', 'l.instagram.com'];
    const fbHosts = ['facebook.com', 'www.facebook.com', 'fb.com', 'l.facebook.com'];
    return !igHosts.includes(hostname) && !fbHosts.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Extract the retailer name from a URL.
 */
export function getRetailerFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();
    const retailers: Record<string, string> = {
      'amazon.com': 'Amazon',
      'target.com': 'Target',
      'etsy.com': 'Etsy',
      'walmart.com': 'Walmart',
      'ebay.com': 'eBay',
      'bestbuy.com': 'Best Buy',
      'nike.com': 'Nike',
      'adidas.com': 'Adidas',
      'instagram.com': 'Instagram',
    };
    return retailers[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
  } catch {
    return 'Unknown';
  }
}
