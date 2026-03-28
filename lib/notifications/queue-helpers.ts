import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from '@/lib/tier-guards';

/**
 * Queue a price-drop row for the in-app bell (+ extension forwarder).
 * Free tier: at most one price-drop notification per item per rolling week.
 */
export async function queuePriceDropNotification(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  oldPrice: number,
  newPrice: number,
  userTier?: string
): Promise<void> {
  if (!oldPrice || oldPrice <= 0) return;

  const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
  if (priceChangePercent >= 0) return;

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
      console.log(
        `[notifications] Free tier — price drop already notified for this item this week, skipping`
      );
      return;
    }
  }

  const { error } = await supabase.from('notification_queue').insert({
    user_id: userId,
    item_id: itemId,
    notification_type: 'price_drop',
    old_price: oldPrice,
    new_price: newPrice,
    price_change_percent: priceChangePercent,
    sent: false,
  });

  if (error) {
    console.warn(`[notifications] Failed to queue price drop: ${error.message}`);
  }
}

export async function queueBackInStockNotification(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  price: number
): Promise<void> {
  const { error } = await supabase.from('notification_queue').insert({
    user_id: userId,
    item_id: itemId,
    notification_type: 'back_in_stock',
    old_price: 0,
    new_price: price,
    price_change_percent: 0,
    sent: false,
  });

  if (error) {
    console.warn(`[notifications] Failed to queue back-in-stock: ${error.message}`);
  }
}

/** Pro+ only — matches GET /api/notifications tier filter for price_increase. */
export async function queuePriceIncreaseNotification(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  oldPrice: number,
  newPrice: number,
  userTier?: string
): Promise<boolean> {
  if (!isTierAtLeast(userTier, 'pro')) {
    return false;
  }

  if (!oldPrice || oldPrice <= 0) return false;

  const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
  if (priceChangePercent <= 0) return false;

  const { error } = await supabase.from('notification_queue').insert({
    user_id: userId,
    item_id: itemId,
    notification_type: 'price_increase',
    old_price: oldPrice,
    new_price: newPrice,
    price_change_percent: priceChangePercent,
    sent: false,
  });

  if (error) {
    console.warn(`[notifications] Failed to queue price increase: ${error.message}`);
    return false;
  }
  return true;
}
