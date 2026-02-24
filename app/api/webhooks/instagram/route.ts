export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getUsername,
  sendReply,
  extractUrlsFromMessage,
  getRetailerFromUrl,
} from '@/lib/instagram/api';
import { checkItemLimit } from '@/lib/tier-guards';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET — Meta webhook verification.
 * Meta sends hub.mode, hub.verify_token, hub.challenge as query params.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[Instagram Webhook] Verification successful');
    return new Response(challenge, { status: 200 });
  }

  console.warn('[Instagram Webhook] Verification failed — token mismatch');
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST — Incoming message events from Meta.
 * Must always return 200 quickly to avoid Meta retries.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.object !== 'instagram') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Process asynchronously but respond 200 immediately
    // (Next.js serverless keeps the function alive for the promise)
    processEntries(body.entry).catch((err) =>
      console.error('[Instagram Webhook] Background processing error:', err)
    );

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[Instagram Webhook] Parse error:', err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

async function processEntries(entries: any[]) {
  if (!Array.isArray(entries)) return;

  for (const entry of entries) {
    if (!Array.isArray(entry.messaging)) continue;

    for (const event of entry.messaging) {
      if (!event.message) continue;
      await handleMessage(event);
    }
  }
}

async function handleMessage(event: any) {
  const senderId = event.sender?.id;
  if (!senderId) return;

  const messageText = (event.message?.text || '').trim().toLowerCase();

  // Handle "connect" command — links the sender's IGSID to their Wist account
  if (messageText === 'connect' || messageText === 'link') {
    await handleConnectCommand(senderId);
    return;
  }

  // Check if this IGSID is verified (has been linked via "connect")
  const { data: verifiedProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('instagram_igsid', senderId)
    .single();

  if (!verifiedProfile) {
    await sendReply(
      senderId,
      'Your Instagram isn\'t connected to Wist yet. To connect:\n\n' +
      '1. Go to wist.com/settings and enter your Instagram handle\n' +
      '2. Send me the message "connect"\n\n' +
      'That\'s it! After that, you can share any ad or product link here to save it.'
    );
    return;
  }

  const urls = extractUrlsFromMessage(event.message);

  if (urls.length === 0) {
    await sendReply(
      senderId,
      "I couldn't find a link in that message. Try sharing an ad or product link!"
    );
    return;
  }

  // Queue each URL as an item
  let savedCount = 0;
  for (const url of urls) {
    const success = await queueItem(verifiedProfile.id, url);
    if (success) savedCount++;
  }

  if (savedCount === 0) {
    await sendReply(senderId, "Something went wrong saving that link. Please try again.");
  } else if (savedCount === 1) {
    await sendReply(
      senderId,
      "Saved! Your item has been queued in Wist. Open Wist on desktop to activate it."
    );
  } else {
    await sendReply(
      senderId,
      `Saved ${savedCount} items to your Wist queue!`
    );
  }
}

/**
 * Handle the "connect" command: verify the sender owns the Instagram handle
 * they entered in Wist settings, then link their IGSID to their profile.
 */
async function handleConnectCommand(igsid: string) {
  // Check if already connected
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, instagram_handle')
    .eq('instagram_igsid', igsid)
    .single();

  if (existing) {
    await sendReply(
      igsid,
      `You're already connected! Just share any ad or product link here and I'll save it to your Wist queue.`
    );
    return;
  }

  // Resolve IGSID to Instagram username
  const username = await getUsername(igsid);
  if (!username) {
    await sendReply(
      igsid,
      "I couldn't verify your Instagram account. Please try again later."
    );
    return;
  }

  // Find a Wist profile that has this Instagram handle (case-insensitive)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, instagram_handle, instagram_igsid')
    .ilike('instagram_handle', username)
    .single();

  if (!profile) {
    await sendReply(
      igsid,
      `I couldn't find a Wist account with the handle @${username}. ` +
      `Make sure you've entered your Instagram username in Wist Settings (wist.com/settings), then send "connect" again.`
    );
    return;
  }

  // Check if another IGSID is already linked (someone else connected this handle)
  if (profile.instagram_igsid && profile.instagram_igsid !== igsid) {
    await sendReply(
      igsid,
      "This Wist account is already connected to a different Instagram account. " +
      "If this is your account, please update your settings at wist.com/settings."
    );
    return;
  }

  // Link the IGSID
  await supabase
    .from('profiles')
    .update({ instagram_igsid: igsid })
    .eq('id', profile.id);

  await sendReply(
    igsid,
    `Connected! Your Instagram (@${username}) is now linked to your Wist account. ` +
    `From now on, just share any ad or product link here and I'll save it to your queue.`
  );

  console.log(`[Instagram Webhook] Verified and linked @${username} (IGSID: ${igsid}) to user ${profile.id}`);
}

/**
 * Insert a queued item for a user, replicating the items table insert pattern.
 */
async function queueItem(userId: string, url: string): Promise<boolean> {
  try {
    // Get or create the user's wishlist
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
    } catch { /* keep default */ }

    const limitCheck = await checkItemLimit(supabase, userId);
    if (!limitCheck.allowed) {
      console.warn(`[Instagram Webhook] Item limit reached for user ${userId}`);
      return false;
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
      console.error('[Instagram Webhook] Insert item error:', error.message);
      return false;
    }

    console.log(`[Instagram Webhook] Queued item for user ${userId}: ${url.substring(0, 60)}`);
    return true;
  } catch (err) {
    console.error('[Instagram Webhook] queueItem error:', err);
    return false;
  }
}
