import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Queue a price-drop row for the in-app bell (+ extension forwarder).
 * Inserts one row per detected drop so the bell always reflects each change.
 */
export async function queuePriceDropNotification(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  oldPrice: number,
  newPrice: number,
  _userTier?: string
): Promise<void> {
  if (!oldPrice || oldPrice <= 0) return;

  const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
  if (priceChangePercent >= 0) return;

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

/** Price went up — same bell UI as drops; all tiers (shown in /api/notifications). */
export async function queuePriceIncreaseNotification(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  oldPrice: number,
  newPrice: number,
  _userTier?: string
): Promise<boolean> {
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
