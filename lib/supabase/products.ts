/**
 * Supabase products operations with user filtering, reservations, and sharing
 */
import { supabase } from './client';
import { priceHistoryTimeMs } from '@/lib/price-history-utils';

export interface SupabaseProduct {
  id: string;
  title: string | null;
  price: number | null;
  image: string | null;
  url: string;
  user_id: string | null;
  created_at: string;
  last_scraped: string | null;
  // Reservation fields
  reserved_by: string | null;
  reserved_at: string | null;
  // Visibility fields (optional - may not exist in DB yet)
  is_public?: boolean;
  share_token?: string | null;
  // Collection field
  collection_id?: string | null;
  // Price tracking fields
  current_price?: number | null;
  price_change?: number | null;
  price_change_percent?: number | null;
  previous_price?: number | null;
  last_price_check?: string | null;
  price_check_failures?: number | null;
  // Currency fields
  original_currency?: string | null;
  // Stock status
  out_of_stock?: boolean;
  /** Max(price in history) − current; drives Treat yourself total when history exists. */
  savings_vs_peak?: number;
}

/**
 * Get items from the items table (used by Chrome extension)
 */
async function getUserItems(userId: string): Promise<{
  data: SupabaseProduct[] | null;
  error: any;
}> {
  // Limit to 100 items and select only needed columns
  const { data, error } = await supabase
    .from('items')
      .select('id, user_id, title, current_price, image_url, url, note, status, retailer, collection_id, created_at, original_currency')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

  if (error) return { data: null, error };

  const converted = (data || []).map((item: any) => {
    let priceValue = null;
    if (item.current_price !== null && item.current_price !== undefined && item.current_price !== '') {
      const numPrice = typeof item.current_price === 'string' 
        ? parseFloat(item.current_price) 
        : Number(item.current_price);
      priceValue = isNaN(numPrice) || numPrice === 0 ? null : numPrice;
    }
    
    return {
      id: item.id,
      title: item.title || 'Untitled Item',
      price: priceValue,
      image: item.image_url || null,
      url: item.url || '#',
      user_id: item.user_id,
      created_at: item.created_at,
      last_scraped: item.created_at,
      reserved_by: null,
      reserved_at: null,
      is_public: false,
      share_token: null,
      domain: item.retailer?.toLowerCase() || null,
      description: item.note || null,
      collection_id: item.collection_id || null,
      original_currency: item.original_currency || 'USD',
    };
  });

  return { data: converted, error: null };
}

function buildPriceHistoryMapFromRows(
  priceHistory: any[] | null | undefined
): Map<string, { rows: { price: number; created_at: string }[]; maxPrice: number }> {
  const priceHistoryMap: Map<
    string,
    { rows: { price: number; created_at: string }[]; maxPrice: number }
  > = new Map();
  if (!priceHistory?.length) return priceHistoryMap;

  const byItem: Map<string, { price: number; created_at: string; _t: number }[]> = new Map();
  for (const entry of priceHistory) {
    const id = entry.item_id as string;
    const row = entry as { price: unknown; created_at?: string | null; recorded_at?: string | null };
    const t = priceHistoryTimeMs(row);
    const arr = byItem.get(id) || [];
    arr.push({
      price: Number(row.price),
      created_at: new Date(t || Date.now()).toISOString(),
      _t: t,
    });
    byItem.set(id, arr);
  }
  byItem.forEach((rows, itemId) => {
    rows.sort((a, b) => b._t - a._t);
    const maxPrice = Math.max(...rows.map((r) => r.price));
    const clean = rows.map(({ price, created_at }) => ({ price, created_at }));
    priceHistoryMap.set(itemId, { rows: clean, maxPrice });
  });
  return priceHistoryMap;
}

/**
 * Merge raw items + products + price_history rows into dashboard payload.
 * Used by GET /api/user/items (service role) and client-side fallback.
 */
export function assembleUserProductsFromRaw(
  itemsRows: any[] | null | undefined,
  productsRows: any[] | null | undefined,
  priceHistoryRows: any[] | null | undefined
): { data: SupabaseProduct[]; queued: any[] } {
  const allItemRows = itemsRows || [];
  const mainItemRows = allItemRows.filter(
    (item: any) => item.status !== 'queued' && item.status !== 'hidden' && item.status !== 'purchased'
  );
  const queuedItemRows = allItemRows.filter((item: any) => item.status === 'queued');
  const priceHistoryMap = buildPriceHistoryMapFromRows(priceHistoryRows);

  const allItems: any[] = [];

  mainItemRows.forEach((item: any) => {
    let priceValue = null;
    if (item.current_price !== null && item.current_price !== undefined && item.current_price !== '') {
      const numPrice =
        typeof item.current_price === 'string'
          ? parseFloat(item.current_price)
          : Number(item.current_price);
      priceValue = isNaN(numPrice) || numPrice === 0 ? null : numPrice;
    }

    const ph = priceHistoryMap.get(item.id);
    let priceChange: number | null = null;
    let priceChangePercent: number | null = null;
    let previousPrice: number | null = null;

    if (priceValue != null && ph && ph.rows.length > 0) {
      const { rows, maxPrice } = ph;
      const prevHist = rows.length >= 2 ? rows[1].price : null;

      if (prevHist !== null) {
        previousPrice = prevHist;
        priceChange = priceValue - prevHist;
        priceChangePercent = prevHist !== 0 ? (priceChange / prevHist) * 100 : 0;
      } else if (rows.length === 1) {
        const only = rows[0].price;
        if (Math.abs(priceValue - only) > 0.001) {
          previousPrice = only;
          priceChange = priceValue - only;
          priceChangePercent = only !== 0 ? (priceChange / only) * 100 : 0;
        }
      }

      if (
        (priceChange === null || Math.abs(priceChange) < 0.001) &&
        maxPrice > priceValue + 0.001
      ) {
        previousPrice = maxPrice;
        priceChange = priceValue - maxPrice;
        priceChangePercent = maxPrice !== 0 ? (priceChange / maxPrice) * 100 : 0;
      }
    }

    let savingsVsPeak = 0;
    if (priceValue != null && ph && ph.rows.length > 0 && ph.maxPrice > priceValue + 0.001) {
      savingsVsPeak = ph.maxPrice - priceValue;
    }

    allItems.push({
      id: item.id,
      title: item.title || 'Untitled Item',
      price: priceValue,
      current_price: priceValue,
      image: item.image_url || null,
      url: item.url || '#',
      user_id: item.user_id,
      created_at: item.created_at,
      last_scraped: item.created_at,
      reserved_by: null,
      reserved_at: null,
      is_public: false,
      share_token: null,
      domain: item.retailer?.toLowerCase() || null,
      description: item.note || null,
      collection_id: item.collection_id || null,
      price_change: priceChange,
      price_change_percent: priceChangePercent,
      previous_price: previousPrice,
      savings_vs_peak: savingsVsPeak,
      last_price_check: item.last_price_check || null,
      original_currency: item.original_currency || 'USD',
      out_of_stock: item.out_of_stock ?? false,
    });
  });

  if (productsRows?.length) {
    productsRows.forEach((product: any) => {
      let priceValue = null;
      if (product.price !== null && product.price !== undefined && product.price !== '') {
        const numPrice =
          typeof product.price === 'string' ? parseFloat(product.price) : Number(product.price);
        priceValue = isNaN(numPrice) || numPrice === 0 ? null : numPrice;
      }

      allItems.push({
        id: product.id,
        title: product.title || 'Untitled Item',
        price: priceValue,
        image: product.image || null,
        url: product.url || '#',
        user_id: product.user_id,
        created_at: product.created_at,
        last_scraped: product.created_at,
        reserved_by: null,
        reserved_at: null,
        is_public: product.is_public || false,
        share_token: product.share_token || null,
        domain: product.domain || null,
        description: product.description || null,
      });
    });
  }

  const seenUrls = new Set<string>();
  const deduplicatedItems: any[] = [];

  allItems.forEach((item) => {
    const normalizedUrl = item.url?.toLowerCase().trim();
    if (normalizedUrl && !seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl);
      deduplicatedItems.push(item);
    } else if (!normalizedUrl) {
      deduplicatedItems.push(item);
    }
  });

  deduplicatedItems.sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });

  const queuedItems: any[] = [];
  queuedItemRows.forEach((item: any) => {
    let priceValue = null;
    if (item.current_price !== null && item.current_price !== undefined && item.current_price !== '') {
      const numPrice =
        typeof item.current_price === 'string'
          ? parseFloat(item.current_price)
          : Number(item.current_price);
      priceValue = isNaN(numPrice) || numPrice === 0 ? null : numPrice;
    }

    queuedItems.push({
      id: item.id,
      title: item.title || null,
      price: priceValue,
      image: item.image_url || null,
      url: item.url || '#',
      user_id: item.user_id,
      created_at: item.created_at,
      status: 'queued',
      domain: item.retailer?.toLowerCase() || null,
      original_currency: item.original_currency || 'USD',
    });
  });

  return { data: deduplicatedItems, queued: queuedItems };
}

/**
 * Get all items for a specific user from BOTH items and products tables
 * Some components save to products table, some to items table
 * We need to query BOTH to show all user's items
 */
export async function getUserProducts(userId: string, viewerId?: string): Promise<{
  data: SupabaseProduct[] | null;
  queued: any[];
  error: any;
}> {
  if (typeof window !== 'undefined') {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id === userId) {
      try {
        const res = await fetch('/api/user/items', { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (!json.error && Array.isArray(json.data)) {
            return {
              data: json.data,
              queued: Array.isArray(json.queued) ? json.queued : [],
              error: null,
            };
          }
        }
      } catch (e) {
        console.warn('[getUserProducts] /api/user/items failed, using direct client', e);
      }
    }
  }

  // Fetch from BOTH tables in parallel with pagination
  // Limit to 100 items per table to prevent large data transfers
  const ITEMS_LIMIT = 100;

  // Fetch ALL items from items table (no status filter) then partition client-side.
  // This avoids PostgREST .or() quirks with null and ensures we never miss items.
  const [itemsResult, productsResult] = await Promise.all([
    supabase
      .from('items')
      .select(`
        id,
        user_id,
        title,
        current_price,
        image_url,
        url,
        note,
        status,
        retailer,
        collection_id,
        created_at,
        last_price_check,
        price_check_failures,
        original_currency,
        out_of_stock
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(150),

    supabase
      .from('products')
      .select(`
        id,
        user_id,
        title,
        price,
        image,
        url,
        description,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(ITEMS_LIMIT),
  ]);

  if (itemsResult.error) {
    console.error('❌ Error fetching items:', itemsResult.error);
  }
  if (productsResult.error) {
    console.error('❌ Error fetching products:', productsResult.error);
  }

  const allItemRows = itemsResult.data || [];
  const mainItemRows = allItemRows.filter(
    (item: any) => item.status !== 'queued' && item.status !== 'hidden' && item.status !== 'purchased'
  );
  const itemIds = mainItemRows.map((item: any) => item.id);

  let priceHistoryRows: any[] | null = null;
  if (itemIds.length > 0) {
    const { data: priceHistory, error: priceHistoryError } = await supabase
      .from('price_history')
      .select('*')
      .in('item_id', itemIds);

    if (priceHistoryError && process.env.NODE_ENV === 'development') {
      console.warn('[getUserProducts] price_history:', priceHistoryError.message);
    }
    priceHistoryRows = priceHistory ?? null;
  }

  const { data: deduplicatedItems, queued: queuedItems } = assembleUserProductsFromRaw(
    itemsResult.data,
    productsResult.data,
    priceHistoryRows
  );

  const error = itemsResult.error || productsResult.error;

  return { data: deduplicatedItems, queued: queuedItems, error: error || null };
}

/**
 * Get public products for a user (by username or share token)
 */
export async function getPublicProducts(usernameOrToken: string): Promise<{
  data: SupabaseProduct[] | null;
  error: any;
}> {
  // First try to find by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', usernameOrToken)
    .single();

  if (profile) {
    // Found by username, get all products (is_public filtering can be added later)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    return { data, error };
  }

  // If not found by username, try share token
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('share_token', usernameOrToken)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Reserve/Purchase an item
 * Only works if user is NOT the owner
 */
export async function reserveProduct(
  productId: string,
  reserverId: string
): Promise<{ error: any }> {
  // First check if user owns this item
  const { data: product } = await supabase
    .from('products')
    .select('user_id, reserved_by')
    .eq('id', productId)
    .single();

  if (!product) {
    return { error: { message: 'Product not found' } };
  }

  if (product.user_id === reserverId) {
    return { error: { message: 'Cannot reserve your own items' } };
  }

  if (product.reserved_by) {
    return { error: { message: 'Item already reserved' } };
  }

  const { error } = await supabase
    .from('products')
    .update({
      reserved_by: reserverId,
      reserved_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .is('reserved_by', null); // Ensure it's not already reserved

  return { error };
}

/**
 * Unreserve an item (only the person who reserved it can do this)
 */
export async function unreserveProduct(
  productId: string,
  reserverId: string
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('products')
    .update({
      reserved_by: null,
      reserved_at: null,
    })
    .eq('id', productId)
    .eq('reserved_by', reserverId); // Only if they're the one who reserved it

  return { error };
}

/**
 * Update product visibility (public/private)
 */
export async function updateProductVisibility(
  productId: string,
  userId: string,
  isPublic: boolean,
  shareToken?: string
): Promise<{ error: any }> {
  // Note: This function requires is_public and share_token columns in Supabase
  // For now, we'll return an error if columns don't exist
  const updateData: any = { is_public: isPublic };
  
  if (isPublic && shareToken) {
    updateData.share_token = shareToken;
  } else if (!isPublic) {
    updateData.share_token = null;
  }

  const { error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .eq('user_id', userId); // Ensure user owns the item

  return { error };
}

/**
 * Update product title
 */
export async function updateProductTitle(
  userId: string,
  productId: string,
  newTitle: string
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('products')
    .update({ title: newTitle.trim() || null })
    .eq('id', productId)
    .eq('user_id', userId); // Ensure user owns the item

  return { error };
}

/**
 * Delete a product (with user verification)
 * Handles both products and items tables
 */
export async function deleteUserProduct(
  userId: string,
  productId: string
): Promise<{ error: any }> {
  // Try products table first
  const { error: productsError } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('user_id', userId);

  // If not found in products, try items table
  if (productsError) {
    const { error: itemsError } = await supabase
      .from('items')
      .delete()
      .eq('id', productId)
      .eq('user_id', userId);

    return { error: itemsError };
  }

  return { error: productsError };
}

/**
 * Get a single product by ID (with user verification)
 */
export async function getUserProduct(
  userId: string,
  productId: string
): Promise<{
  data: SupabaseProduct | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('user_id', userId)
    .single();

  return { data, error };
}
