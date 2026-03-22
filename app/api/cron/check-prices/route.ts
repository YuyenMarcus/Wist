import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { TIERS, type SubscriptionTier } from '@/lib/constants/subscription-tiers';
import { isTierAtLeast } from '@/lib/tier-guards';
import { staticScrape } from '@/lib/scraper/static-scraper';

function getTierCheckInterval(tier: string): number {
  const config = TIERS[tier as SubscriptionTier];
  if (!config) return TIERS.free.intervalMs;
  return config.intervalMs;
}

// Notification queue helper - queues price drop notifications for users
async function queuePriceDropNotification(
  supabase: any,
  userId: string,
  itemId: string,
  oldPrice: number,
  newPrice: number,
  userTier?: string
) {
  // Need a real baseline price to compute a drop (avoid NaN / Infinity when oldPrice is 0)
  if (!oldPrice || oldPrice <= 0) return;

  const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

  if (priceChangePercent >= 0) return;

  // Free tier: at most one price-drop notification per item per week (not one for whole account)
  if (!userTier || userTier === 'free') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('notification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('item_id', itemId)
      .eq('notification_type', 'price_drop')
      .gte('created_at', weekAgo);

    if ((count || 0) > 0) {
      console.log(`   ⏳ Free tier — price drop already notified for this item this week, skipping`);
      return;
    }
  }

  const { error } = await (supabase as any)
    .from('notification_queue')
    .insert({
      user_id: userId,
      item_id: itemId,
      notification_type: 'price_drop',
      old_price: oldPrice,
      new_price: newPrice,
      price_change_percent: priceChangePercent,
      sent: false,
    });
  
  if (error) {
    console.log(`   ⚠️  Failed to queue notification: ${error.message}`);
  } else {
    console.log(`   🔔 Notification queued for user (${Math.abs(priceChangePercent).toFixed(1)}% drop)`);
  }
}

async function queueBackInStockNotification(
  supabase: any,
  userId: string,
  itemId: string,
  price: number
) {
  const { error } = await supabase
    .from('notification_queue')
    .insert({
      user_id: userId,
      item_id: itemId,
      notification_type: 'back_in_stock',
      old_price: 0,
      new_price: price,
      price_change_percent: 0,
      sent: false,
    });

  if (error) {
    console.log(`   ⚠️  Failed to queue back-in-stock notification: ${error.message}`);
  } else {
    console.log(`   🔔 Back-in-stock notification queued at $${price}`);
  }
}

/** Pro+ only — matches GET /api/notifications tier filter for price_increase. Returns true if a row was inserted. */
async function queuePriceIncreaseNotification(
  supabase: any,
  userId: string,
  itemId: string,
  oldPrice: number,
  newPrice: number,
  userTier?: string
): Promise<boolean> {
  if (!isTierAtLeast(userTier, 'pro')) {
    console.log(`   ⏳ Price increase alerts are Pro+ only, skipping queue`);
    return false;
  }

  if (!oldPrice || oldPrice <= 0) return false;

  const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
  if (priceChangePercent <= 0) return false;

  const { error } = await (supabase as any)
    .from('notification_queue')
    .insert({
      user_id: userId,
      item_id: itemId,
      notification_type: 'price_increase',
      old_price: oldPrice,
      new_price: newPrice,
      price_change_percent: priceChangePercent,
      sent: false,
    });

  if (error) {
    console.log(`   ⚠️  Failed to queue price-increase notification: ${error.message}`);
    return false;
  }
  console.log(`   🔔 Price increase notification queued (+${priceChangePercent.toFixed(1)}%)`);
  return true;
}

// ⚠️ CRITICAL CHANGE: Use the SERVICE_ROLE_KEY
// This bypasses RLS so the bot can see ALL items
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Check your .env.local file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';
// Hobby plan caps at 60s; Pro/Enterprise can use longer (set in Vercel dashboard if needed)
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    // Verify cron secret to prevent unauthorized access (if CRON_SECRET is set)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If CRON_SECRET is set, require authentication
      // Vercel cron jobs automatically add this header, but manual calls need it
      console.warn('⚠️ Unauthorized cron access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log("\n--- ⏰ STARTING PRICE CHECK (ADMIN MODE) ---");
    
    // Track scraper services that timeout so we skip them for the rest of the run
    const deadScrapers = new Set<string>();
    
    // NOTE: We intentionally do NOT gate this job on price_history timestamps.
    // A global "last insert within 30m" check blocked the entire cron whenever
    // a user ran a manual price check — starving all automated checks.

    console.log("✅ Service role:", process.env.SUPABASE_SERVICE_ROLE_KEY ? 'yes' : 'no (using anon)');

    // Runs every 6 hours (vercel.json). Process as many items as possible
    // within the serverless timeout. Increase these if you upgrade to a
    // longer maxDuration on Vercel Pro/Enterprise.
    const BATCH_SIZE = 50;
    const MAX_ITEMS = 200;
    
    let totalChecked = 0;
    let updateCount = 0;
    let notificationCount = 0;

    console.log(`📊 Processing up to ${MAX_ITEMS} items`);

    // Scan cooldown: all tiers get scanned daily minimum.
    // Higher tiers get checked more frequently.
    function tierCooldownHours(tier: string): number {
      switch (tier) {
        case 'creator':
        case 'enterprise': return 6;
        case 'pro': return 12;
        default: return 24; // free = daily scan (notifications still gated to weekly)
      }
    }

    type ItemType = {
      id: string;
      user_id: string;
      title: string;
      url: string;
      current_price: number | null;
      status?: string;
      updated_at?: string;
      last_price_check?: string;
      price_check_failures?: number;
      out_of_stock?: boolean;
      user_tier?: string;
    };

    // Keep fetching batches until we hit MAX_ITEMS or run out of eligible items.
    // Each iteration re-queries because processItem() updates last_price_check,
    // pushing checked items to the back of the queue automatically.
    while (totalChecked < MAX_ITEMS) {
      const fetchLimit = Math.min(BATCH_SIZE * 4, (MAX_ITEMS - totalChecked) * 3);

      // Fetch items with their owner's subscription tier via a profiles join
      const { data: rawItems, error } = await supabase
        .from('items')
        .select('id, user_id, title, url, current_price, status, updated_at, last_price_check, price_check_failures, out_of_stock, profiles!items_user_id_fkey(subscription_tier)')
        .not('url', 'is', null)
        .eq('status', 'active')
        .order('last_price_check', { ascending: true, nullsFirst: true })
        .limit(fetchLimit);

      if (error) {
        console.error("❌ DB Error:", error.message, error.code);
        // Fallback: query without the join if it fails (e.g. FK not named correctly)
        const { data: fallbackItems, error: fbErr } = await supabase
          .from('items')
          .select('id, user_id, title, url, current_price, status, updated_at, last_price_check, price_check_failures, out_of_stock')
          .not('url', 'is', null)
          .eq('status', 'active')
          .order('last_price_check', { ascending: true, nullsFirst: true })
          .limit(fetchLimit);

        if (fbErr) {
          return NextResponse.json({ error: fbErr.message }, { status: 500 });
        }

        let fbItems = ((fallbackItems || []) as unknown as ItemType[]).map(i => ({ ...i, user_tier: 'free' }));

        const fbNow = Date.now();
        fbItems = fbItems.filter(item => {
          if (!item.last_price_check) return true;
          const elapsed = fbNow - new Date(item.last_price_check).getTime();
          const failures = item.price_check_failures || 0;
          const baseCooldown = tierCooldownHours(item.user_tier || 'free');
          const cooldownMs = (baseCooldown + failures * 12) * 3600000;
          return elapsed >= cooldownMs;
        }).slice(0, BATCH_SIZE);

        if (fbItems.length === 0) break;
        console.log(`\n📦 Processing ${fbItems.length} items (fallback, no tier join)`);

        for (const item of fbItems) { await processItem(item); }
        break;
      }

      // Normalize the joined data — profiles comes back as an object or array
      let items: ItemType[] = ((rawItems || []) as any[]).map((row: any) => {
        const tier = row.profiles?.subscription_tier || (Array.isArray(row.profiles) ? row.profiles[0]?.subscription_tier : null) || 'free';
        return { ...row, user_tier: tier, profiles: undefined };
      });
      
      // Filter by tier-aware cooldown
      const now = Date.now();
      items = items.filter(item => {
        if (!item.last_price_check) return true;
        const elapsed = now - new Date(item.last_price_check).getTime();
        const failures = item.price_check_failures || 0;
        const baseCooldown = tierCooldownHours(item.user_tier || 'free');
        const cooldownMs = (baseCooldown + failures * 12) * 3600000;
        return elapsed >= cooldownMs;
      });

      if (items.length === 0) {
        console.log('\n✅ No more eligible items to check');
        break;
      }

      // Prioritize higher-tier items first
      const tierPriority: Record<string, number> = { enterprise: 0, creator: 1, pro: 2, free: 3 };
      items.sort((a, b) => (tierPriority[a.user_tier || 'free'] ?? 4) - (tierPriority[b.user_tier || 'free'] ?? 4));
      items = items.slice(0, Math.min(BATCH_SIZE, MAX_ITEMS - totalChecked));

      console.log(`\n📦 Batch: processing ${items.length} items (${totalChecked} done so far)`);

      for (const item of items) {
        await processItem(item);
      }
    }

    async function processItem(item: any) {
      console.log(`\n🔍 Checking: ${item.title?.substring(0, 30)}...`);
      console.log(`   URL: ${item.url}`);
      console.log(`   DB Price: $${item.current_price}`);
      console.log(`   Tier: ${item.user_tier || 'free'}`);
      console.log(`   Last Check: ${item.last_price_check || 'Never'}`);
      console.log(`   Failures: ${item.price_check_failures || 0}`);

      try {
        const seen = new Set<string>();
        const scraperUrls = [
          process.env.PRICE_TRACKER_URL,
          process.env.MAIN_SCRAPER_URL,
          process.env.NEXT_PUBLIC_SCRAPER_SERVICE_URL,
        ].filter((u): u is string => {
          if (!u) return false;
          if (seen.has(u)) return false;
          if (deadScrapers.has(u)) return false;
          seen.add(u);
          return true;
        });

        let freshData = null;

        for (const scraperUrl of scraperUrls) {
          if (freshData) break;
          try {
            console.log(`   🔄 Trying: ${scraperUrl.substring(0, 50)}...`);
            const response = await fetch(`${scraperUrl}/api/scrape/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: item.url }),
              signal: AbortSignal.timeout(8000),
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (data.success && data.result && data.result.price) {
              freshData = {
                current_price: parseFloat(data.result.price) || null,
                title: data.result.title || item.title,
                priceRaw: data.result.priceRaw || data.result.price,
                image: data.result.image,
                description: data.result.description,
              };
              console.log(`   ✅ External scraper: $${freshData.current_price}`);
            } else {
              throw new Error(data.error || 'No price');
            }
          } catch (err: any) {
            const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('abort');
            if (isTimeout) {
              deadScrapers.add(scraperUrl);
              console.log(`   ❌ ${scraperUrl.substring(0, 40)}... timed out — marking dead for this run`);
            } else {
              console.log(`   ⚠️  ${scraperUrl.substring(0, 40)}... failed: ${err.message}`);
            }
          }
        }

        if (!freshData) {
          try {
            console.log(`   🔄 Static scraper...`);
            const result = await staticScrape(item.url);
            if (result && result.price && result.price > 0) {
              freshData = {
                current_price: result.price,
                title: result.title || item.title,
                priceRaw: result.priceRaw,
                image: result.image,
                description: result.description,
              };
              console.log(`   ✅ Static scraper: $${freshData.current_price}`);
            } else if (result && result.priceRaw) {
              const parsed = parseFloat(result.priceRaw.replace(/[^0-9.]/g, ''));
              if (parsed > 0) {
                freshData = {
                  current_price: parsed,
                  title: result.title || item.title,
                  priceRaw: result.priceRaw,
                  image: result.image,
                  description: result.description,
                };
                console.log(`   ✅ Static scraper (parsed): $${freshData.current_price}`);
              }
            }
          } catch (err: any) {
            console.log(`   ⚠️  Static scraper failed: ${err.message}`);
          }
        }

        if (!freshData || !freshData.current_price) {
          console.log("   ❌ Scrape failed");
          const failureCount = (item.price_check_failures || 0) + 1;
          // Bump last_price_check so this item doesn't stay permanently at the front
          // of the queue and starve every other item on the next cron run.
          await supabase.from('items').update({
            price_check_failures: failureCount,
            last_price_check: new Date().toISOString(),
          }).eq('id', item.id);
          totalChecked++;
          return;
        }

        const newPrice = freshData.current_price;
        const oldPrice = item.current_price || 0;
        const priceChanged = Math.abs(Number(newPrice) - Number(oldPrice)) > 0.01;

        console.log(`   ✅ Scrape Success: Found $${newPrice}`);

        if (item.out_of_stock && newPrice > 0) {
          console.log(`   🎉 BACK IN STOCK at $${newPrice}!`);
          await queueBackInStockNotification(supabase, item.user_id, item.id, newPrice);
          notificationCount++;
        }

        const updateData: any = {
          last_price_check: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          price_check_failures: 0,
        };

        if (priceChanged) {
          updateData.current_price = newPrice;
          console.log(`   💰 PRICE DIFFERENCE! Updating DB...`);
          console.log(`   Old: $${oldPrice} → New: $${newPrice}`);
          updateCount++;
          
          if (newPrice < oldPrice && item.user_id) {
            await queuePriceDropNotification(supabase, item.user_id, item.id, oldPrice, newPrice, item.user_tier);
            notificationCount++;
          }

          if (newPrice > oldPrice && item.user_id) {
            const changePct = ((newPrice - oldPrice) / oldPrice) * 100;
            console.log(`   📈 Price increased +${changePct.toFixed(1)}%`);
            const queued = await queuePriceIncreaseNotification(
              supabase,
              item.user_id,
              item.id,
              oldPrice,
              newPrice,
              item.user_tier
            );
            if (queued) notificationCount++;
          }
        } else {
          console.log("   💤 No change in price.");
        }
        
        const updateResult = await supabase.from('items').update(updateData).eq('id', item.id);
        
        if (updateResult.error) {
          console.log(`   ❌ Update Error: ${updateResult.error.message}`);
        } else {
          console.log(`   ✅ Item updated in DB`);
        }
        
        const historyResult = await supabase.from('price_history').insert({
          item_id: item.id,
          price: newPrice
        });

        if (historyResult.error) {
          console.log(`   ⚠️  History Error: ${historyResult.error.message}`);
        } else {
          console.log(`   ✅ Price history logged (${priceChanged ? 'price changed' : 'same price'})`);
        }
        
      } catch (error: any) {
        console.error(`   ❌ Error checking item:`, error.message);
        
        const failureCount = (item.price_check_failures || 0) + 1;
        await supabase.from('items').update({
          last_price_check: new Date().toISOString(),
          price_check_failures: failureCount
        }).eq('id', item.id);
      }
      
      await new Promise(r => setTimeout(r, 500));
      totalChecked++;
    }

    console.log("\n--- JOB FINISHED ---");
    console.log(`📊 Checked ${totalChecked}, Updated ${updateCount}, Notifications ${notificationCount}`);
    
    return NextResponse.json({ 
      success: true, 
      checked: totalChecked, 
      updates: updateCount,
      notifications: notificationCount,
      message: `Processed ${totalChecked} items, updated ${updateCount} prices.`
    });

  } catch (error: any) {
    console.error("CRITICAL CRON ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}