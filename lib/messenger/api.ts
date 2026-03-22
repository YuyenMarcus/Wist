const MESSENGER_API_BASE = 'https://graph.facebook.com/v21.0';

function getAccessToken(): string | null {
  return process.env.PAGE_ACCESS_TOKEN || null;
}

/**
 * Send a message to a Messenger user (PSID) via the Send API.
 */
export async function sendReply(recipientId: string, text: string): Promise<boolean> {
  const token = getAccessToken();
  if (!token) {
    console.error('[Messenger] PAGE_ACCESS_TOKEN not configured');
    return false;
  }
  try {
    const url = `${MESSENGER_API_BASE}/me/messages?access_token=${encodeURIComponent(token)}`;
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
      console.error(`[Messenger] sendReply failed (${res.status}):`, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Messenger] sendReply error:', err);
    return false;
  }
}
