const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0';

function getAccessToken(): string {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('INSTAGRAM_ACCESS_TOKEN not configured');
  return token;
}

/**
 * Resolve an Instagram-Scoped User ID (IGSID) to a username.
 */
export async function getUsername(igsid: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${igsid}?fields=username&access_token=${getAccessToken()}`
    );
    if (!res.ok) {
      console.error(`[Instagram] Failed to resolve IGSID ${igsid}:`, res.status);
      return null;
    }
    const data = await res.json();
    return data.username || null;
  } catch (err) {
    console.error('[Instagram] getUsername error:', err);
    return null;
  }
}

/**
 * Send a DM reply to an Instagram user via the Send API.
 */
export async function sendReply(recipientId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        access_token: getAccessToken(),
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
