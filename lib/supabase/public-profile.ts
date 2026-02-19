/**
 * Public Profile Data Access Layer
 * 
 * This module handles fetching public profile data following the "Two-Table" architecture:
 * - items table: User's personal wishlist links
 * - products table: Global catalog (used to hydrate missing data)
 * 
 * Security: Only returns items with status='active' to prevent exposing purchase history
 */

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './client';

export interface PublicProfileData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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
  // Use admin client to bypass RLS for public profile lookup
  const supabase = getSupabaseAdmin();

  // URL decode the username (handles %20, etc.)
  const decodedUsername = decodeURIComponent(username).toLowerCase().trim();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio')
    .eq('username', decodedUsername)
    .maybeSingle();

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
async function fetchActiveItems(userId: string): Promise<{
  items: any[];
  error: any;
}> {
  const supabase = getSupabaseAdmin();

  const [itemsResult, productsResult] = await Promise.all([
    supabase
      .from('items')
      .select('id, title, url, current_price, image_url, retailer, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, title, url, price, image, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (itemsResult.error) {
    console.error('Error fetching active items:', itemsResult.error);
  }
  if (productsResult.error) {
    console.error('Error fetching products:', productsResult.error);
  }

  const allItems: any[] = [];

  if (itemsResult.data) {
    itemsResult.data.forEach((item: any) => {
      allItems.push({
        id: item.id,
        title: item.title,
        url: item.url,
        current_price: item.current_price,
        image_url: item.image_url,
        retailer: item.retailer,
        created_at: item.created_at,
      });
    });
  }

  if (productsResult.data) {
    productsResult.data.forEach((product: any) => {
      allItems.push({
        id: product.id,
        title: product.title,
        url: product.url,
        current_price: product.price,
        image_url: product.image,
        retailer: null,
        created_at: product.created_at,
      });
    });
  }

  // Deduplicate by URL - items table takes priority
  const seenUrls = new Set<string>();
  const deduped: any[] = [];
  allItems.forEach(item => {
    const normalizedUrl = item.url?.toLowerCase().trim();
    if (normalizedUrl && !seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl);
      deduped.push(item);
    } else if (!normalizedUrl) {
      deduped.push(item);
    }
  });

  deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const error = itemsResult.error || productsResult.error;
  return { items: deduped, error: error || null };
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
 * @returns Public profile data with sanitized items
 */
export async function getPublicProfile(username: string): Promise<{
  profile: PublicProfileData | null;
  items: PublicItem[];
  error: any;
}> {
  try {
    // Step A: Resolve username to user_id
    const { userId, profile, error: resolveError } = await resolveUsernameToUserId(username);

    if (resolveError) {
      return { profile: null, items: [], error: resolveError };
    }

    if (!userId || !profile) {
      // User not found - return 404
      return { profile: null, items: [], error: { message: 'User not found', code: 'NOT_FOUND' } };
    }

    // Step B: Fetch active items
    const { items: rawItems, error: itemsError } = await fetchActiveItems(userId);

    if (itemsError) {
      return { profile, items: [], error: itemsError };
    }

    // Step C: Hydrate from products table
    const hydratedItems = await hydrateFromProductsTable(rawItems);

    // Step D: Sanitize data
    const sanitizedItems = sanitizeItems(hydratedItems);

    return {
      profile,
      items: sanitizedItems,
      error: null,
    };
  } catch (error: any) {
    console.error('Error in getPublicProfile:', error);
    return {
      profile: null,
      items: [],
      error: { message: error.message || 'Failed to load public profile' },
    };
  }
}

