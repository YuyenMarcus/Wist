import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Notification queue helper - queues price drop notifications for users
async function queuePriceDropNotification(
  supabase: any,
  userId: string,
  itemId: string,
  oldPrice: number,
  newPrice: number
) {
  const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
  
  // Only notify for price DROPS (negative change)
  if (priceChangePercent >= 0) return;
  
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

// ⚠️ CRITICAL CHANGE: Use the SERVICE_ROLE_KEY
// This bypasses RLS so the bot can see ALL items
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Check your .env.local file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = 'force-dynamic';

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
    
    // ============================================
    // RATE LIMITING: Prevent accidental spam
    // ============================================
    const RATE_LIMIT_HOURS = 1; // Minimum 1 hour between runs
    
    // Check last run time from a simple key-value store
    // Using a simple approach: check if there's a recent entry in price_history
    // (Alternative: use a system_config table or Redis)
    const { data: recentHistory } = await supabase
      .from('price_history')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (recentHistory?.created_at) {
      const lastRunTime = new Date(recentHistory.created_at);
      const hoursSinceLastRun = (Date.now() - lastRunTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastRun < RATE_LIMIT_HOURS) {
        const minutesRemaining = Math.ceil((RATE_LIMIT_HOURS - hoursSinceLastRun) * 60);
        console.log(`⏸️  Rate limit: Last run was ${Math.round(hoursSinceLastRun * 60)} minutes ago. Please wait ${minutesRemaining} more minutes.`);
        return NextResponse.json({ 
          error: `Rate limit: Please wait ${minutesRemaining} more minutes before running again.`,
          lastRun: lastRunTime.toISOString(),
          nextRunAvailable: new Date(Date.now() + (RATE_LIMIT_HOURS - hoursSinceLastRun) * 60 * 60 * 1000).toISOString()
        }, { status: 429 });
      }
    }
    
    console.log("🔍 Environment Variable Check:");
    console.log("   NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Found" : "❌ Missing");
    console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Found" : "❌ Missing");
    console.log("   SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Found" : "❌ Missing");
    
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("\n⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY not found!");
      console.warn("   Make sure .env.local is in the ROOT folder (same level as package.json)");
      console.warn("   File should be at: C:\\Users\\yuyen\\OneDrive\\Desktop\\Projects\\wist\\.env.local");
      console.warn("   After adding it, you MUST restart the server (Ctrl+C, then npm run dev)");
      console.warn("   Using ANON_KEY instead (may fail with RLS)");
    } else {
      console.log("\n✅ Using SERVICE_ROLE_KEY (bypasses RLS)");
    }

    // ============================================
    // OPTIMIZED: Process items in batches with pagination
    // ============================================
    const BATCH_SIZE = 50; // Process 50 items at a time
    const MAX_ITEMS_TO_CHECK = 200; // Limit total items per run (prevents timeout)
    
    let totalChecked = 0;
    let updateCount = 0;
    let notificationCount = 0;
    let offset = 0;
    let hasMore = true;

    // Only select columns we actually need (reduces data transfer)
    // Include user_id for notifications
    const selectColumns = 'id, user_id, title, url, current_price, status, updated_at';

    console.log(`📊 Starting batch processing (batch size: ${BATCH_SIZE}, max items: ${MAX_ITEMS_TO_CHECK})`);

    // Process items in batches
    while (hasMore && totalChecked < MAX_ITEMS_TO_CHECK) {
      // 1. Get batch of items that need checking
      // Priority: Items that haven't been checked in 24+ hours, or never checked
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
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
      };
      
      let items: ItemType[] | null = null;
      let error: any = null;
      
      const initialQuery = await supabase
        .from('items')
        .select(selectColumns + ', last_price_check, price_check_failures')
        .not('url', 'is', null)
        .eq('status', 'active') // Only check active items (not purchased)
        .or(`last_price_check.is.null,last_price_check.lt.${twentyFourHoursAgo}`) // Not checked in 24h
        .order('last_price_check', { ascending: true, nullsFirst: true }) // Check oldest first
        .limit(BATCH_SIZE);

      if (initialQuery.error) {
        error = initialQuery.error;
        items = null;
      } else {
        // Type assertion through unknown to handle Supabase's union types
        items = (initialQuery.data as unknown) as ItemType[] | null;
      }

      // If error, try without status filter and last_price_check filter (in case columns don't exist)
      if (error) {
        console.log("⚠️  Query error (might be missing columns), trying simplified query...");
        const retry = await supabase
          .from('items')
          .select('id, user_id, title, url, current_price, status, updated_at')
          .not('url', 'is', null)
          .order('created_at', { ascending: true })
          .limit(BATCH_SIZE);
      
        if (retry.error) {
          error = retry.error;
          items = null;
        } else {
          // Type assertion through unknown to handle Supabase's union types
          items = (retry.data as unknown) as ItemType[] | null;
          error = null;
        }
      }

      // Debugging output
      if (error) {
        console.error("❌ Database Error:", error.message);
        console.error("   Code:", error.code);
        console.error("   Details:", error.details);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!items || items.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`\n📦 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${items.length} items (total checked: ${totalChecked})`);

      // 2. Loop and Check items in this batch
      for (const item of items) {
        console.log(`\n🔍 Checking: ${item.title?.substring(0, 30)}...`);
        console.log(`   URL: ${item.url}`);
        console.log(`   DB Price: $${item.current_price}`);
        console.log(`   Last Check: ${item.last_price_check || 'Never'}`);
        console.log(`   Failures: ${item.price_check_failures || 0}`);

        try {
          // SCRAPE using price tracker scraper service with retry logic
          // Use price tracker for checking prices (wist-scraper-clean-production)
          const priceTrackerUrl = process.env.PRICE_TRACKER_URL || process.env.SCRAPER_SERVICE_URL;
          if (!priceTrackerUrl) {
            console.log("   ❌ PRICE_TRACKER_URL not configured");
            totalChecked++;
            continue;
          }

          let freshData = null;
          let retries = 3;
          
          while (retries > 0 && !freshData) {
            try {
              console.log(`   🔄 Calling price tracker scraper service... (attempt ${4 - retries}/3)`);
              
              const response = await fetch(`${priceTrackerUrl}/api/scrape/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.url }),
                signal: AbortSignal.timeout(30000) // 30 second timeout
              });

              if (!response.ok) {
                throw new Error(`Scraper service returned ${response.status}: ${response.statusText}`);
              }

              const data = await response.json();
              
              if (data.success && data.result && data.result.price) {
                // Convert Railway service response to expected format
                freshData = {
                  current_price: parseFloat(data.result.price) || null,
                  title: data.result.title || item.title,
                  priceRaw: data.result.priceRaw || data.result.price,
                  image: data.result.image,
                  description: data.result.description
                };
                console.log(`   ✅ Scraper service returned price: $${freshData.current_price}`);
              } else {
                throw new Error(data.error || 'No price in response');
              }
            } catch (error: any) {
              console.log(`   ⚠️  Scrape attempt failed: ${error.message}`);
              retries--;
              if (retries > 0) {
                console.log(`   ⚠️  Retrying... (${retries} attempts left)`);
                await new Promise(r => setTimeout(r, 2000)); // Wait before retry
              }
            }
          }

          if (!freshData || !freshData.current_price) {
            console.log("   ❌ Scrape Failed: Could not fetch price after retries");
            
            // Update failure count
            const failureCount = (item.price_check_failures || 0) + 1;
            await supabase.from('items').update({
              last_price_check: new Date().toISOString(),
              price_check_failures: failureCount
            }).eq('id', item.id);
            
            if (failureCount >= 5) {
              console.log(`   ⚠️  Item has failed ${failureCount} times - may need manual review`);
            }
            
            totalChecked++;
            continue;
          }

          const newPrice = freshData.current_price;
          const oldPrice = item.current_price || 0;
          const priceChanged = Math.abs(Number(newPrice) - Number(oldPrice)) > 0.01;

          console.log(`   ✅ Scrape Success: Found $${newPrice}`);

          // Update item (always update last_price_check and reset failures)
          const updateData: any = {
            last_price_check: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            price_check_failures: 0 // Reset on success
          };

          if (priceChanged) {
            updateData.current_price = newPrice;
            console.log(`   💰 PRICE DIFFERENCE! Updating DB...`);
            console.log(`   Old: $${oldPrice} → New: $${newPrice}`);
            updateCount++;
            
            // Queue notification if price DROPPED (newPrice < oldPrice)
            if (newPrice < oldPrice && item.user_id) {
              await queuePriceDropNotification(supabase, item.user_id, item.id, oldPrice, newPrice);
              notificationCount++;
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
          
          // ALWAYS log price history (even if unchanged) to build graph data over time
          // This ensures users see price trends on the graph, even if the price is stable
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
          
          // Update failure count
          const failureCount = (item.price_check_failures || 0) + 1;
          await supabase.from('items').update({
            last_price_check: new Date().toISOString(),
            price_check_failures: failureCount
          }).eq('id', item.id);
        }
        
        // Polite Delay between items
        await new Promise(r => setTimeout(r, 2000));
        
        totalChecked++;
      }

      // Check if we've reached the limit
      if (totalChecked >= MAX_ITEMS_TO_CHECK) {
        console.log(`\n⚠️  Reached max items limit (${MAX_ITEMS_TO_CHECK}). Stopping.`);
        hasMore = false;
        break;
      }

      // Check if there are more items to process
      // Since we're using limit instead of range, check if we got a full batch
      if (items.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        // Continue to next batch (offset is not used with limit, but we track it for logging)
        offset += BATCH_SIZE;
      }

      // Small delay between batches
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log("\n--- JOB FINISHED ---");
    console.log(`📊 Summary: Checked ${totalChecked} items, Updated ${updateCount} prices, Queued ${notificationCount} notifications`);
    
    return NextResponse.json({ 
      success: true, 
      checked: totalChecked, 
      updates: updateCount,
      notifications: notificationCount,
      message: totalChecked >= MAX_ITEMS_TO_CHECK 
        ? `Processed ${totalChecked} items (limit reached). More items will be checked in next run.`
        : `Processed all ${totalChecked} items.`
    });

  } catch (error: any) {
    console.error("CRITICAL CRON ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}