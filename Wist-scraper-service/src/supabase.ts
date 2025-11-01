import { createClient } from '@supabase/supabase-js';
import { NormalizedProduct } from './types';

function getSupabase() {
  const url = process.env.SUPABASE_URL || null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function saveToSupabase(
  userId: string,
  product: NormalizedProduct
): Promise<{ success: boolean; error?: any }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase.from('wishlist_items').insert([
      {
        user_id: userId,
        title: product.title,
        description: product.description,
        price: product.price,
        price_raw: product.priceRaw,
        currency: product.currency,
        image: product.image,
        domain: product.domain,
        url: product.url,
        meta: { scraped_at: new Date().toISOString() },
      },
    ]);

    if (error) {
      console.error('Supabase insert failed:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (e: any) {
    console.error('Supabase save error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Log a failed scrape attempt to Supabase for analytics
 * This creates a "blocked domain list" for future reference
 */
export async function logScrapeError(
  url: string,
  domain: string | null,
  reason: string,
  errorType: 'timeout' | 'blocked' | 'parse_error' | 'network_error' | 'unknown'
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    // Silently fail if Supabase not configured - don't break the service
    return;
  }

  try {
    await supabase.from('scrape_errors').insert([
      {
        url,
        domain,
        reason,
        error_type: errorType,
        failed_at: new Date().toISOString(),
      },
    ]);
  } catch (e) {
    // Silently fail - logging errors shouldn't break the service
    console.error('Failed to log scrape error to Supabase:', e);
  }
}