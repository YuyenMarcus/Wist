export const dynamic = 'force-dynamic';
/** Allow DM handling (Supabase + Graph) to finish before the invocation is frozen */
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import {
  getUsername,
  sendReply,
  getRetailerFromUrl,
  getInstagramDmUserFollowStatus,
  getInstagramBusinessHandleForCopy,
} from '@/lib/instagram/api';
import { extractResolvedWishlistUrls, isDuplicateQueuedUrl } from '@/lib/messaging/wishlist-urls';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkItemLimitForApi } from '@/lib/tier-guards';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

/**
 * Returns true if this delivery should be processed, false if already handled (Meta retries / races).
 * Requires table instagram_webhook_processed_mids (see supabase-instagram-webhook-dedupe.sql).
 */
async function claimInstagramWebhookMessageMid(mid: string): Promise<boolean> {
  try {
    const { error } = await getServiceRoleSupabase()
      .from('instagram_webhook_processed_mids')
      .insert({ mid });

    if (!error) return true;

    // PostgreSQL unique violation — same webhook redelivered
    if (error.code === '23505') {
      return false;
    }

    console.warn('[Instagram Webhook] claim mid insert error (processing anyway):', error.code, error.message);
    return true;
  } catch (e) {
    console.warn('[Instagram Webhook] claim mid exception (processing anyway):', e);
    return true;
  }
}

/**
 * GET — Meta webhook verification.
 * Meta sends hub.mode=subscribe, hub.verify_token=..., hub.challenge=...
 * Response must be 200 with the challenge as plain text only (no JSON).
 * Visiting in a browser (no params) returns 200 with a short info message.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // No verification params (e.g. opened in browser) — respond with info, not error
  if (!mode && !challenge) {
    return new Response(
      'Instagram webhook endpoint. Verification is done by Meta with ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...',
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  if (mode !== 'subscribe' || !challenge) {
    return new Response('Bad Request', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  // Instagram has its own verify token in Meta (can be different from Messenger)
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;
  if (!verifyToken || token !== verifyToken) {
    console.warn('[Instagram Webhook] Verification failed — token mismatch or INSTAGRAM_VERIFY_TOKEN not set');
    return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  }

  console.log('[Instagram Webhook] Verification successful');
  return new Response(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * POST — Incoming message events from Meta.
 * Must always return 200 quickly to avoid Meta retries.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log every webhook call so we can see if Meta is hitting us at all
    const obj = body?.object ?? 'missing';
    const entryCount = Array.isArray(body?.entry) ? body.entry.length : 0;
    console.log('[Instagram Webhook] POST received. object=' + obj + ', entryCount=' + entryCount);
    if (obj !== 'instagram') {
      console.log('[Instagram Webhook] Payload snippet:', JSON.stringify(body).slice(0, 300));
    }

    // Only Instagram DM events have object === 'instagram'. Messenger uses object === 'page'.
    if (body.object !== 'instagram') {
      console.log('[Instagram Webhook] Ignoring (expected "instagram" for Instagram DMs). Add Instagram webhook in Meta and message the Instagram account, not Messenger.');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log('[Instagram Webhook] Received Instagram event, entries:', body.entry?.length);
    // Must await: if we return 200 first, Vercel/serverless can freeze the isolate and kill
    // handleConnectCommand / DB work mid-flight (logs stop right after arbitrary lines).
    try {
      await processEntries(body.entry);
    } catch (err) {
      console.error('[Instagram Webhook] processEntries error:', err);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[Instagram Webhook] Parse error:', err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

async function processEntries(entries: any[]) {
  if (!Array.isArray(entries)) return;

  // Same payload can list the same message twice; Meta can also retry the whole POST.
  const seenMidInPayload = new Set<string>();

  for (const entry of entries) {
    const messaging = entry.messaging;
    if (!Array.isArray(messaging)) {
      console.warn('[Instagram Webhook] entry.messaging missing or not array. entry keys:', entry ? Object.keys(entry) : 'null');
      continue;
    }

    for (const event of messaging) {
      if (!event.message) continue;

      const mid = typeof event.message.mid === 'string' ? event.message.mid : null;
      if (mid) {
        if (seenMidInPayload.has(mid)) {
          console.log('[Instagram Webhook] Skipping duplicate mid in same payload:', mid);
          continue;
        }
        seenMidInPayload.add(mid);
      }

      const text = (event.message?.text || '').trim();
      console.log('[Instagram Webhook] Message from', event.sender?.id, ':', text.slice(0, 50));
      await handleMessage(event);
    }
  }
}

/**
 * Require follower of the business IG (Meta User Profile API). Unknown = allow (don’t block if API fails).
 */
async function requireInstagramFollowForDm(igsid: string, actionDescription: string): Promise<boolean> {
  const status = await getInstagramDmUserFollowStatus(igsid);
  if (status !== 'not_following') {
    return true;
  }
  const handle = getInstagramBusinessHandleForCopy();
  const who = handle ? `@${handle}` : 'this Instagram account';
  await sendReply(
    igsid,
    `Please follow ${who} first — then you can ${actionDescription}.\n\n` +
      `Open our profile, tap Follow, then try again.`
  );
  return false;
}

async function handleMessage(event: any) {
  const senderId = event.sender?.id;
  if (!senderId) {
    console.warn('[Instagram Webhook] No sender id in event');
    return;
  }

  // Outbound DMs from our app arrive as echoes — do not reply again.
  if (event.message?.is_echo === true) {
    console.log('[Instagram Webhook] Skipping is_echo message');
    return;
  }

  const mid = typeof event.message?.mid === 'string' ? event.message.mid : null;
  if (mid) {
    const claimed = await claimInstagramWebhookMessageMid(mid);
    if (!claimed) {
      console.log('[Instagram Webhook] Skipping already-processed mid (retry/duplicate):', mid);
      return;
    }
  } else {
    console.warn('[Instagram Webhook] No message.mid in payload — dedupe across retries may be incomplete');
  }

  const messageText = (event.message?.text || '').trim().toLowerCase();
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wishlist.nuvio.cloud';

  // Handle "connect" / "confirm" — links the sender's IGSID to their Wist account
  if (messageText === 'connect' || messageText === 'link' || messageText === 'confirm') {
    console.log('[Instagram Webhook] Connect command from sender:', senderId);
    if (!(await requireInstagramFollowForDm(senderId, 'connect Wist to your Instagram'))) {
      return;
    }
    try {
      await handleConnectCommand(senderId, APP_URL);
    } catch (err) {
      console.error('[Instagram Webhook] handleConnectCommand error:', err);
      await sendReply(
        senderId,
        "Something went wrong on our end. Please make sure you've added your Instagram handle in Wist Settings and try again. If it keeps failing, contact support."
      );
    }
    return;
  }

  // Check if this IGSID is verified (has been linked via "connect")
  const { data: verifiedProfile } = await getServiceRoleSupabase()
    .from('profiles')
    .select('id')
    .eq('instagram_igsid', senderId)
    .maybeSingle();

  if (!verifiedProfile) {
    await sendReply(
      senderId,
      'Your Instagram isn\'t connected to Wist yet. To connect:\n\n' +
      `1. Go to ${APP_URL}/settings and enter your Instagram handle, then save.\n` +
      '2. Follow this account on Instagram, then send "connect" or "confirm" here.\n\n' +
      'After that, use the share button (paper plane) on any post or ad and send it to us — we\'ll add it to your Wist dashboard.'
    );
    return;
  }

  if (!(await requireInstagramFollowForDm(senderId, 'save shared links here'))) {
    return;
  }

  // Log attachment structure for debugging shared post content
  if (Array.isArray(event.message?.attachments)) {
    console.log('[Instagram Webhook] Attachments:', JSON.stringify(event.message.attachments.map((a: any) => ({
      type: a.type,
      payloadKeys: a.payload ? Object.keys(a.payload) : [],
      url: (a.payload?.url || '').substring(0, 100),
    }))));
  }

  const urls = await extractResolvedWishlistUrls(event.message, { source: 'instagram' });

  if (urls.length === 0) {
    const hasAttachments = Array.isArray(event.message?.attachments) && event.message.attachments.length > 0;
    if (hasAttachments) {
      await sendReply(
        senderId,
        "I got the image from that post, but I couldn't find a product link in it.\n\n" +
        "Try this instead:\n" +
        "1. Open the post\n" +
        "2. Tap the product or link in bio\n" +
        "3. Copy the URL from your browser\n" +
        "4. Paste it here\n\n" +
        "I'll add it to your Wist!"
      );
    } else {
      await sendReply(
        senderId,
        "I couldn't find a link in that message. Try sharing a product link!"
      );
    }
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
      'Saved! Your item is queued in Wist. Open Wist on desktop to finish adding it.'
    );
  } else {
    await sendReply(
      senderId,
      `Saved ${savedCount} items to your Wist queue! Open Wist on desktop when you're ready.`
    );
  }
}

/**
 * Handle the "connect" command: verify the sender owns the Instagram handle
 * they entered in Wist settings, then link their IGSID to their profile.
 */
async function handleConnectCommand(igsid: string, appUrl: string) {
  // Log env *before* getServiceRoleSupabase() — that call can throw synchronously if URL/key missing.
  console.log('[Instagram Webhook] Token present:', !!process.env.INSTAGRAM_ACCESS_TOKEN);
  console.log('[Instagram Webhook] Token length:', process.env.INSTAGRAM_ACCESS_TOKEN?.length ?? 0);
  console.log('[Instagram Webhook] Supabase URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[Instagram Webhook] Service role key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('[Instagram Webhook] About to call getServiceRoleSupabase...');
  let supabase: SupabaseClient;
  try {
    supabase = getServiceRoleSupabase();
    console.log('[Instagram Webhook] Supabase client created successfully');
  } catch (e: unknown) {
    // String(e) logs non-Error throws too (e.message would be undefined)
    console.error('[Instagram Webhook] getServiceRoleSupabase threw:', String(e));
    await sendReply(
      igsid,
      "We couldn't reach Wist right now (database config). Please try again later or contact support."
    );
    return;
  }
  console.log('[Instagram Webhook] Past supabase init');

  if (!process.env.INSTAGRAM_ACCESS_TOKEN) {
    console.error('[Instagram Webhook] INSTAGRAM_ACCESS_TOKEN is not set');
    await sendReply(igsid, "Our Instagram link isn't set up yet. Please try again later or contact support.");
    return;
  }

  console.log('[Instagram Webhook] About to run query...');

  let existing: { id: string; instagram_handle: string | null } | null = null;
  let existingError: { message: string } | null = null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, instagram_handle')
      .eq('instagram_igsid', igsid)
      .maybeSingle();

    existing = data;
    existingError = error;

    console.log('[Instagram Webhook] Query result - data:', data, 'error:', error?.message);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[Instagram Webhook] Query hard threw:', msg, stack);
    await sendReply(
      igsid,
      "We couldn't reach Wist right now. Please try again in a moment or contact support if this keeps happening."
    );
    return;
  }

  if (existing) {
    await sendReply(
      igsid,
      "You're already connected! You can send any product or post link here and it'll be added to your Wist dashboard."
    );
    return;
  }

  console.log('[Instagram Webhook] Step 3 - calling getUsername');
  const username = await getUsername(igsid);
  console.log('[Instagram Webhook] Step 4 - username result:', username);

  if (!username) {
    await sendReply(
      igsid,
      "I couldn't verify your Instagram account. Please try again later."
    );
    return;
  }

  console.log('[Instagram Webhook] Step 5 - profile lookup by handle:', username);
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, instagram_handle, instagram_igsid')
    .ilike('instagram_handle', username)
    .maybeSingle();

  console.log('[Instagram Webhook] Step 6 - profile:', profile?.id ?? null, 'profileError:', profileError?.message ?? null);

  if (profileError) {
    console.warn('[Instagram Webhook] Profile lookup error for @' + username, profileError.message);
  }
  if (!profile) {
    await sendReply(
      igsid,
      `I couldn't find a Wist account with the handle @${username}. ` +
      `Enter your Instagram username in Wist Settings (${appUrl}/settings), save, then send "connect" or "confirm" again.`
    );
    return;
  }

  if (profile.instagram_igsid && profile.instagram_igsid !== igsid) {
    await sendReply(
      igsid,
      `This Wist account is already connected to a different Instagram. Update your settings at ${appUrl}/settings if this is your account.`
    );
    return;
  }

  console.log('[Instagram Webhook] Step 7 - updating instagram_igsid for profile', profile.id);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ instagram_igsid: igsid })
    .eq('id', profile.id);

  console.log('[Instagram Webhook] Step 8 - updateError:', updateError?.message ?? null);

  console.log('[Instagram Webhook] Step 9 - sending success reply');
  await sendReply(
    igsid,
    `You're connected! You can now send any link or post here and it'll be added to your Wist dashboard. Try sending a product link.`
  );

  console.log('[Instagram Webhook] Step 10 - done. Linked @' + username + ' (IGSID: ' + igsid + ') to user ' + profile.id);
}

/**
 * Insert a queued item for a user, replicating the items table insert pattern.
 */
async function queueItem(userId: string, url: string): Promise<boolean> {
  try {
    const supabase = getServiceRoleSupabase();
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

    const limitCheck = await checkItemLimitForApi(userId, supabase);
    if (!limitCheck.allowed) {
      console.warn(`[Instagram Webhook] Item limit reached for user ${userId}`);
      return false;
    }

    if (await isDuplicateQueuedUrl(supabase, userId, url)) {
      console.log(`[Instagram Webhook] Skipping duplicate queued URL for user ${userId}`);
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
