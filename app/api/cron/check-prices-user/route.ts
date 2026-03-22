import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase, hasServiceRoleKey } from '@/lib/supabase/service-role';
import { isTierAtLeast } from '@/lib/tier-guards';
import { staticScrape } from '@/lib/scraper/static-scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/cron/check-prices-user
 *
 * On-demand, user-scoped price check for paid-tier users.
 * Called from the dashboard when a Pro/Creator user loads the page,
 * checking their stale items that the daily cron hasn't reached yet.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasServiceRoleKey()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
    }

    const admin = getServiceRoleSupabase();

    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle();

    const tier = profile?.subscription_tier || 'free';

    if (!isTierAtLeast(tier, 'pro')) {
      return NextResponse.json({ skipped: true, reason: 'free_tier' });
    }

    const cooldownHours = tier === 'creator' || tier === 'enterprise' ? 6 : 12;
    const cutoff = new Date(Date.now() - cooldownHours * 3600_000).toISOString();
    const LIMIT = tier === 'creator' || tier === 'enterprise' ? 30 : 15;

    const { data: staleItems, error: itemsErr } = await admin
      .from('items')
      .select('id, url, title, current_price, last_price_check, price_check_failures, out_of_stock')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('url', 'is', null)
      .or(`last_price_check.is.null,last_price_check.lt.${cutoff}`)
      .order('last_price_check', { ascending: true, nullsFirst: true })
      .limit(LIMIT);

    if (itemsErr) {
      console.error('[check-prices-user] query error', itemsErr.message);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    if (!staleItems || staleItems.length === 0) {
      return NextResponse.json({ checked: 0, updated: 0, message: 'All items are up to date' });
    }

    const deadScrapers = new Set<string>();
    let checked = 0;
    let updated = 0;

    for (const item of staleItems) {
      const scraperUrls = ([
        process.env.PRICE_TRACKER_URL,
        process.env.MAIN_SCRAPER_URL,
        process.env.NEXT_PUBLIC_SCRAPER_SERVICE_URL,
      ].filter(Boolean) as string[]).filter((u) => !deadScrapers.has(u));

      let newPrice: number | null = null;

      for (const scraperUrl of scraperUrls) {
        if (newPrice) break;
        try {
          const res = await fetch(`${scraperUrl}/api/scrape/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url }),
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) continue;
          const data = await res.json();
          const payload = data.result || data.data;
          const isOk = data.success || data.ok;
          if (isOk && payload?.price) {
            newPrice = parseFloat(payload.price) || null;
          }
        } catch (err: any) {
          if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
            deadScrapers.add(scraperUrl);
          }
        }
      }

      if (!newPrice) {
        try {
          const result = await staticScrape(item.url);
          if (result?.price && result.price > 0) {
            newPrice = result.price;
          } else if (result?.priceRaw) {
            const parsed = parseFloat(result.priceRaw.replace(/[^0-9.]/g, ''));
            if (parsed > 0) newPrice = parsed;
          }
        } catch {}
      }

      const now = new Date().toISOString();

      if (newPrice && newPrice > 0) {
        const oldPrice = item.current_price || 0;
        const priceChanged = Math.abs(newPrice - oldPrice) > 0.01;
        const updateData: Record<string, any> = {
          last_price_check: now,
          updated_at: now,
          price_check_failures: 0,
        };
        if (priceChanged) {
          updateData.current_price = newPrice;
          updated++;

          if (oldPrice > 0) {
            const pct = ((newPrice - oldPrice) / oldPrice) * 100;
            const notifType = pct < 0 ? 'price_drop' : 'price_increase';
            if (notifType === 'price_drop' || isTierAtLeast(tier, 'pro')) {
              await admin.from('notification_queue').insert({
                user_id: user.id,
                item_id: item.id,
                notification_type: notifType,
                old_price: oldPrice,
                new_price: newPrice,
                price_change_percent: pct,
                sent: false,
              });
            }
          }
        }

        await admin.from('items').update(updateData).eq('id', item.id);
        await admin.from('price_history').insert({ item_id: item.id, price: newPrice });
      } else {
        await admin.from('items').update({
          last_price_check: now,
          price_check_failures: (item.price_check_failures || 0) + 1,
        }).eq('id', item.id);
      }

      checked++;
      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({ checked, updated, message: `Checked ${checked} items, ${updated} price changes` });
  } catch (err: any) {
    console.error('[check-prices-user]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
