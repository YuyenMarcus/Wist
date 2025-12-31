/**
 * Supabase products operations with user filtering, reservations, and sharing
 */
import { supabase } from './client';

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
}

/**
 * Get items from the items table (used by Chrome extension)
 */
async function getUserItems(userId: string): Promise<{
  data: SupabaseProduct[] | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error };

  // Convert items table format to SupabaseProduct format
  const converted = (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    price: item.current_price ? parseFloat(item.current_price.toString()) : null,
    image: item.image_url,
    url: item.url,
    user_id: item.user_id,
    created_at: item.created_at,
    last_scraped: item.created_at,
    reserved_by: null,
    reserved_at: null,
    is_public: false,
    share_token: null,
    // Map retailer to domain for compatibility
    domain: item.retailer?.toLowerCase() || null,
    description: item.note || null,
  }));

  return { data: converted, error: null };
}

/**
 * Get all items for a specific user from the items table (Your Personal List)
 * Dashboard should ONLY show items from the items table, not products table
 * 
 * ✅ CORRECT: Queries items table with strict user_id filter
 * This ensures users only see their own wishlist items
 * The delete endpoint also uses items table, so IDs will match
 */
export async function getUserProducts(userId: string, viewerId?: string): Promise<{
  data: SupabaseProduct[] | null;
  error: any;
}> {
  // ✅ CORRECT: Only fetch from items table (Your Personal List)
  // Explicitly select columns that exist in the flat schema (no joins needed)
  // Strict ownership check: .eq('user_id', userId) ensures users only see their own items
  const { data, error } = await supabase
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
      created_at
    `)
    .eq('user_id', userId) // Strict ownership check - critical for security
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  // Convert items table format to SupabaseProduct format
  const converted = (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    price: item.current_price ? parseFloat(item.current_price.toString()) : null,
    image: item.image_url,
    url: item.url,
    user_id: item.user_id,
    created_at: item.created_at,
    last_scraped: item.created_at,
    reserved_by: null,
    reserved_at: null,
    is_public: false,
    share_token: null,
    // Map retailer to domain for compatibility
    domain: item.retailer?.toLowerCase() || null,
    description: item.note || null,
  }));

  return { data: converted, error: null };
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
