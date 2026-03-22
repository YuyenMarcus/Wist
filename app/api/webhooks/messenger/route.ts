export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getRetailerFromUrl } from '@/lib/instagram/api';
import { extractResolvedWishlistUrls, isDuplicateQueuedUrl } from '@/lib/messaging/wishlist-urls';
import { sendReply } from '@/lib/messenger/api';
import { checkItemLimitForApi } from '@/lib/tier-guards';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wishlist.nuvio.cloud';

async function claimMessengerWebhookMessageMid(mid: string): Promise<boolean> {
  try {
    const { error } = await getServiceRoleSupabase()
      .from('messenger_webhook_processed_mids')
      .insert({ mid });

    if (!error) return true;
    if (error.code === '23505') return false;
    console.warn('[Messenger Webhook] claim mid insert error (processing anyway):', error.code, error.message);
    return true;
  } catch (e) {
    console.warn('[Messenger Webhook] claim mid exception (processing anyway):', e);
    return true;
  }
}

/**
 * GET — Meta webhook verification.
 * Facebook sends hub.mode=subscribe, hub.verify_token=..., hub.challenge=...
 * You must return 200 with the challenge as plain text (no JSON).
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !challenge) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // Messenger has its own verify token in Meta (can be different from Instagram)
  const verifyToken = process.env.MESSENGER_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;
  if (!verifyToken || token !== verifyToken) {
    console.warn('[Messenger Webhook] Verification failed — token mismatch or MESSENGER_VERIFY_TOKEN not set');
    return new NextResponse('Forbidden', { status: 403 });
  }

  console.log('[Messenger Webhook] Verification successful');
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * POST — Incoming message events from Meta.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object !== 'page') {
      return new NextResponse('EVENT_RECEIVED', { status: 200 });
    }

    try {
      await processEntries(body.entry);
    } catch (err) {
      console.error('[Messenger Webhook] processEntries error:', err);
    }

    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (err) {
    console.error('[Messenger Webhook] Parse error:', err);
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  }
}

async function processEntries(entries: any[]) {
  if (!Array.isArray(entries)) return;

  const seenMidInPayload = new Set<string>();

  for (const entry of entries) {
    const messaging = entry.messaging || [];
    for (const event of messaging) {
      if (!event.message) continue;

      const mid = typeof event.message.mid === 'string' ? event.message.mid : null;
      if (mid) {
        if (seenMidInPayload.has(mid)) {
          console.log('[Messenger Webhook] Skipping duplicate mid in same payload:', mid);
          continue;
        }
        seenMidInPayload.add(mid);
      }

      await handleMessage(event);
    }
  }
}

async function handleMessage(event: any) {
  const senderId = event.sender?.id;
  if (!senderId) return;

  if (event.message?.is_echo === true) {
    console.log('[Messenger Webhook] Skipping is_echo message');
    return;
  }

  const mid = typeof event.message?.mid === 'string' ? event.message.mid : null;
  if (mid) {
    const claimed = await claimMessengerWebhookMessageMid(mid);
    if (!claimed) {
      console.log('[Messenger Webhook] Skipping already-processed mid (retry/duplicate):', mid);
      return;
    }
  } else {
    console.warn('[Messenger Webhook] No message.mid — dedupe across retries may be incomplete');
  }

  const rawText = (event.message?.text || '').trim();
  const messageText = rawText.toLowerCase();

  // connect <8 hex> or confirm <8 hex> — link Facebook Messenger to Wist (code from Settings)
  const codeMatch = rawText.match(/^(?:connect|confirm)\s+([a-f0-9]{8})$/i);
  if (codeMatch) {
    const token = codeMatch[1].toLowerCase();
    console.log('[Messenger Webhook] Connect-with-code from sender:', senderId);
    try {
      await handleMessengerConnectCommand(senderId, token);
    } catch (err) {
      console.error('[Messenger Webhook] handleMessengerConnectCommand error:', err);
      await sendReply(
        senderId,
        'Something went wrong linking Messenger. Open Wist Settings, generate a new code, and try again.'
      );
    }
    return;
  }

  // Plain connect / link / confirm without code — instruct user
  if (messageText === 'connect' || messageText === 'link' || messageText === 'confirm') {
    await sendReply(
      senderId,
      `To link Facebook Messenger to Wist:\n\n` +
        `1. Open ${APP_URL}/settings\n` +
        `2. Under Facebook Messenger, click Generate link code\n` +
        `3. Come back here and send:\n\n` +
        `connect YOURCODE\n\n` +
        `(Use the code from Wist — not the word "YOURCODE".)`
    );
    return;
  }

  const { data: verifiedProfile } = await getServiceRoleSupabase()
    .from('profiles')
    .select('id')
    .eq('messenger_psid', senderId)
    .maybeSingle();

  if (!verifiedProfile) {
    await sendReply(
      senderId,
      `Messenger isn't linked to Wist yet.\n\n` +
        `1. Open ${APP_URL}/settings\n` +
        `2. Generate a link code under Facebook Messenger\n` +
        `3. Send: connect YOURCODE\n\n` +
        `You can still use Instagram DM to save links if you've connected there.`
    );
    return;
  }

  if (Array.isArray(event.message?.attachments)) {
    for (const att of event.message.attachments) {
      console.log(`[Messenger Webhook] Attachment type="${att.type}" payload=${JSON.stringify(att.payload || {}).slice(0, 500)}`);
    }
  }

  const urls = await extractResolvedWishlistUrls(event.message);

  if (urls.length === 0) {
    const hasAttachments = Array.isArray(event.message?.attachments) && event.message.attachments.length > 0;
    await sendReply(
      senderId,
      hasAttachments
        ? "I couldn't extract a product link from that share. Try copying the product URL and pasting it here instead!"
        : "I couldn't find a link in that message. Try sharing a product link!"
    );
    return;
  }

  console.log(`[Messenger Webhook] Resolved ${urls.length} URL(s): ${urls.map(u => u.slice(0, 80)).join(', ')}`);

  let savedCount = 0;
  for (const url of urls) {
    const success = await queueItem(verifiedProfile.id, url);
    if (success) savedCount++;
  }

  if (savedCount === 0) {
    await sendReply(senderId, 'Something went wrong saving that link. Please try again.');
  } else if (savedCount === 1) {
    await sendReply(senderId, 'Got it! Adding that to your wishlist now.');
  } else {
    await sendReply(senderId, `Got it! Saved ${savedCount} items to your wishlist.`);
  }
}

async function handleMessengerConnectCommand(psid: string, token: string) {
  const supabase = getServiceRoleSupabase();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, messenger_psid, messenger_link_token')
    .eq('messenger_link_token', token)
    .maybeSingle();

  if (error) {
    console.error('[Messenger Webhook] Profile lookup by token error:', error.message);
    await sendReply(psid, "We couldn't look up that code. Try generating a new one in Wist Settings.");
    return;
  }

  if (!profile) {
    await sendReply(
      psid,
      `That code doesn't match any Wist account (or it already expired).\n\n` +
        `Open ${APP_URL}/settings → Facebook Messenger → Generate link code, then send:\n\nconnect YOURCODE`
    );
    return;
  }

  if (profile.messenger_psid && profile.messenger_psid !== psid) {
    await sendReply(
      psid,
      'This Wist account is already linked to a different Messenger chat. Disconnect Facebook Messenger in Wist Settings first, then try again.'
    );
    return;
  }

  const { data: psidOwner } = await supabase
    .from('profiles')
    .select('id')
    .eq('messenger_psid', psid)
    .maybeSingle();

  if (psidOwner && psidOwner.id !== profile.id) {
    await sendReply(
      psid,
      'This Messenger account is already linked to another Wist account. Log into that Wist account and disconnect Messenger in Settings if you want to move it.'
    );
    return;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      messenger_psid: psid,
      messenger_link_token: null,
    })
    .eq('id', profile.id);

  if (updateError) {
    console.error('[Messenger Webhook] Failed to set messenger_psid:', updateError.message);
    await sendReply(psid, "We couldn't save the link. Try again or contact support.");
    return;
  }

  await sendReply(
    psid,
    "You're connected! Send any product link here and we'll add it to your Wist wishlist."
  );
}

async function queueItem(userId: string, url: string): Promise<boolean> {
  const supabase = getServiceRoleSupabase();
  try {
    let { data: wishlists } = await supabase
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    let wishlistId: string;
    if (!wishlists || wishlists.length === 0) {
      const { data: newWl, error } = await supabase
        .from('wishlists')
        .insert({ user_id: userId, title: 'My Wishlist', visibility: 'private' })
        .select()
        .single();
      if (error || !newWl) return false;
      wishlistId = newWl.id;
    } else {
      wishlistId = wishlists[0].id;
    }

    const retailer = getRetailerFromUrl(url);
    let title = 'New Item';
    try {
      const hostname = new URL(url).hostname.replace('www.', '');
      title = `Item from ${hostname}`;
    } catch {
      /* keep default */
    }

    const limitCheck = await checkItemLimitForApi(userId, supabase);
    if (!limitCheck.allowed) {
      console.warn(`[Messenger Webhook] Item limit reached for user ${userId}`);
      return false;
    }

    if (await isDuplicateQueuedUrl(supabase, userId, url)) {
      console.log(`[Messenger Webhook] Skipping duplicate queued URL for user ${userId}`);
      return true;
    }

    const { error } = await supabase.from('items').insert({
      title,
      current_price: 0,
      url,
      image_url: null,
      retailer,
      status: 'queued',
      user_id: userId,
      wishlist_id: wishlistId,
    });

    if (error) {
      console.error('[Messenger Webhook] Insert item error:', error.message);
      return false;
    }

    console.log(`[Messenger Webhook] Queued item for user ${userId}: ${url.substring(0, 60)}`);
    return true;
  } catch (err) {
    console.error('[Messenger Webhook] queueItem error:', err);
    return false;
  }
}
