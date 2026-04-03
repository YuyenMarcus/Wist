/**
 * Public Profile Data Access Layer
 * 
 * This module handles fetching public profile data following the "Two-Table" architecture:
 * - items table: User's personal wishlist links
 * - products table: Global catalog (used to hydrate missing data)
 * 
 * Security: Only returns items with status='active' to prevent exposing purchase history
 */

import { isTierAtLeast } from '@/lib/tier-guards';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './client';

export interface PublicProfileData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  website: string | null;
  subscription_tier: string | null;
  profile_theme: string | null;
  gifting_enabled: boolean;
  gifting_message: string | null;
  amazon_affiliate_id: string | null;
  /** When true, adult-detected titles show blurred images on shared pages (owner setting). */
  adult_content_filter: boolean;
}

export interface PublicItem {
  id: string;
  title: string;
  url: string;
  price: number | null;
  image: string | null;
  retailer: string | null;
}

/**
 * Step A: Resolve Username to User ID
 * 
 * @param username - The username from URL (should be URL-decoded)
 * @returns User ID or null if not found
 */
async function resolveUsernameToUserId(username: string): Promise<{
  userId: string | null;
  profile: PublicProfileData | null;
  error: any;
}> {
  const supabase = getSupabaseAdmin();
  const decodedUsername = decodeURIComponent(username).toLowerCase().trim();

  // Try full query first, fall back to core columns if gifting columns don't exist yet
  let data: any = null;
  let error: any = null;

  const fullSelect = 'id, username, full_name, avatar_url, bio, instagram_handle, tiktok_handle, website, subscription_tier, profile_theme, gifting_enabled, gifting_message, amazon_affiliate_id';
  const coreSelect = 'id, username, full_name, avatar_url, bio, instagram_handle, tiktok_handle, website, subscription_tier, profile_theme';

  const result = await supabase
    .from('profiles')
    .select(fullSelect)
    .eq('username', decodedUsername)
    .maybeSingle();

  if (result.error && result.error.message?.includes('not found')) {
    console.warn('Some profile columns missing, retrying with core columns...');
    const fallback = await supabase
      .from('profiles')
      .select(coreSelect)
      .eq('username', decodedUsername)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  } else {
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error('Error resolving username:', error);
    return { userId: null, profile: null, error };
  }

  if (!data) {
    return { userId: null, profile: null, error: null };
  }

  return {
    userId: data.id,
    profile: {
      id: data.id,
      username: data.username!,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      bio: data.bio,
      instagram_handle: data.instagram_handle || null,
      tiktok_handle: data.tiktok_handle || null,
      website: data.website || null,
      subscription_tier: data.subscription_tier || null,
      profile_theme: data.profile_theme || null,
      gifting_enabled: data.gifting_enabled ?? false,
      gifting_message: data.gifting_message ?? null,
      amazon_affiliate_id: isTierAtLeast(data.subscription_tier, 'pro')
        ? (data.amazon_affiliate_id ?? null)
        : null,
      adult_content_filter: data.adult_content_filter ?? true,
    },
    error: null,
  };
}

/**
 * Step B: Fetch User's Active Items from BOTH items and products tables
 * 
 * Only fetches items with status='active' to prevent exposing purchase history
 * 
 * @param userId - The user's UUID
 * @returns Array of items with only public-safe fields
 */
async function fetchActiveItems(
  userId: string,
  collectionId?: string | null
): Promise<{
  items: any[];
  error: any;
}> {
  const supabase = getSupabaseAdmin();

  // Only fetch from items table (the source of truth for a user's active wishlist)
  // The products table is used purely for hydration of missing images/prices
  let query = supabase
    .from('items')
    .select('id, title, url, current_price, image_url, retailer, created_at')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (collectionId) {
    query = query.eq('collection_id', collectionId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active items:', error);
    return { items: [], error };
  }

  const items = (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    current_price: item.current_price,
    image_url: item.image_url,
    retailer: item.retailer,
    created_at: item.created_at,
  }));

  return { items, error: null };
}

/**
 * Step C: Hydrate Missing Data from Products Table
 * 
 * The "Two-Table" hydration: Some items might have null images/prices
 * because that data lives in the products table (global catalog).
 * 
 * @param items - Items from items table
 * @returns Items with hydrated data from products table
 */
async function hydrateFromProductsTable(items: any[]): Promise<any[]> {
  if (items.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();

  // Collect all URLs from items
  const urls = items
    .map(item => item.url)
    .filter((url): url is string => !!url);

  if (urls.length === 0) {
    return items;
  }

  // Query products table for matching URLs
  const { data: products } = await supabase
    .from('products')
    .select('url, image, price')
    .in('url', urls);

  if (!products || products.length === 0) {
    return items;
  }

  // Create a lookup map: url -> product data
  const productMap = new Map<string, any>();
  products.forEach(product => {
    if (product.url) {
      productMap.set(product.url, product);
    }
  });

  // Merge: Fill in missing image/price from products table
  return items.map(item => {
    const productData = productMap.get(item.url);
    
    if (productData) {
      // Only fill in if item is missing the data
      return {
        ...item,
        image_url: item.image_url || productData.image || null,
        current_price: item.current_price || productData.price || null,
      };
    }
    
    return item;
  });
}

/**
 * Step D: Data Sanitization
 * 
 * Ensures strict typing and removes null values that crash UI components
 * 
 * @param items - Raw items from database
 * @returns Sanitized items ready for frontend
 */
function sanitizeItems(items: any[]): PublicItem[] {
  return items.map(item => {
    // Convert price to number (Postgres might return string)
    let price: number | null = null;
    if (item.current_price !== null && item.current_price !== undefined) {
      const numPrice = typeof item.current_price === 'string'
        ? parseFloat(item.current_price)
        : Number(item.current_price);
      price = isNaN(numPrice) || numPrice === 0 ? null : numPrice;
    }

    // Set default fallback image if still missing
    const image = item.image_url || null;

    // Ensure title is never null (fallback to "Untitled Item")
    const title = item.title || 'Untitled Item';

    return {
      id: item.id,
      title: title.substring(0, 200), // Limit title length
      url: item.url || '#',
      price,
      image,
      retailer: item.retailer || null,
    };
  });
}

/**
 * Main Public Profile Fetcher
 * 
 * Follows the complete blueprint:
 * 1. Resolve username to user_id
 * 2. Fetch active items only
 * 3. Hydrate missing data from products table
 * 4. Sanitize data for frontend
 * 
 * @param username - Username from URL (will be URL-decoded)
 * @param options.collectionSlug - When set, only items in that collection (public share link).
 * @returns Public profile data with sanitized items
 */
export interface SharedCollectionData {
  name: string;
  slug: string;
  id?: string;
  registry_mode?: boolean;
  background_image_url?: string | null;
  /** Present when owner enabled collaboration; path e.g. /invite/AbCdEf12 */
  collab_join_href?: string | null;
}

export async function getPublicProfile(
  username: string,
  options?: { collectionSlug?: string }
): Promise<{
  profile: PublicProfileData | null;
  items: PublicItem[];
  sharedCollection: SharedCollectionData | null;
  reservations: Record<string, { name: string | null }>;
  error: any;
}> {
  try {
    // Step A: Resolve username to user_id
    const { userId, profile, error: resolveError } = await resolveUsernameToUserId(username);

    if (resolveError) {
      return { profile: null, items: [], sharedCollection: null, reservations: {}, error: resolveError };
    }

    if (!userId || !profile) {
      return {
        profile: null,
        items: [],
        sharedCollection: null,
        reservations: {},
        error: { message: 'User not found', code: 'NOT_FOUND' },
      };
    }

    let collectionId: string | null = null;
    let sharedCollection: SharedCollectionData | null = null;

    if (options?.collectionSlug) {
      const slug = decodeURIComponent(options.collectionSlug).toLowerCase().trim();
      const supabase = getSupabaseAdmin();
      const { data: col, error: colError } = await supabase
        .from('collections')
        .select(
          'id, name, slug, registry_mode, background_image_url, collaborative_enabled, collaboration_invite_code'
        )
        .eq('user_id', userId)
        .eq('slug', slug)
        .maybeSingle();

      if (colError || !col) {
        return {
          profile: null,
          items: [],
          sharedCollection: null,
          reservations: {},
          error: { message: 'Collection not found', code: 'NOT_FOUND' },
        };
      }
      collectionId = col.id;
      const collabOn = col.collaborative_enabled === true;
      const inviteCode =
        typeof col.collaboration_invite_code === 'string' ? col.collaboration_invite_code.trim() : '';
      sharedCollection = {
        name: col.name,
        slug: col.slug,
        registry_mode: col.registry_mode ?? false,
        background_image_url: col.background_image_url ?? null,
        id: col.id,
        collab_join_href:
          collabOn && inviteCode ? `/invite/${encodeURIComponent(inviteCode)}` : null,
      };
    }

    // Step B: Fetch active items (optionally scoped to one collection)
    const { items: rawItems, error: itemsError } = await fetchActiveItems(userId, collectionId);

    if (itemsError) {
      return { profile, items: [], sharedCollection, reservations: {}, error: itemsError };
    }

    // Step C: Deduplicate by URL (keep the newest entry)
    const seenUrls = new Set<string>();
    const uniqueItems = rawItems.filter(item => {
      if (!item.url) return true;
      const normalized = item.url.split('?')[0].replace(/\/+$/, '').toLowerCase();
      if (seenUrls.has(normalized)) return false;
      seenUrls.add(normalized);
      return true;
    });

    // Step D: Hydrate from products table
    const hydratedItems = await hydrateFromProductsTable(uniqueItems);

    // Step E: Sanitize data
    const sanitizedItems = sanitizeItems(hydratedItems);

    // Fetch reservations if registry mode is on
    let reservations: Record<string, { name: string | null }> = {};
    if (sharedCollection?.registry_mode && collectionId) {
      const supabase = getSupabaseAdmin();
      const { data: res } = await supabase
        .from('item_reservations')
        .select('item_id, reserver_name')
        .eq('collection_id', collectionId);

      if (res) {
        for (const r of res) {
          reservations[r.item_id] = { name: r.reserver_name };
        }
      }
    }

    return {
      profile,
      items: sanitizedItems,
      sharedCollection,
      reservations,
      error: null,
    };
  } catch (error: any) {
    console.error('Error in getPublicProfile:', error);
    return {
      profile: null,
      items: [],
      sharedCollection: null,
      reservations: {},
      error: { message: error.message || 'Failed to load public profile' },
    };
  }
}

