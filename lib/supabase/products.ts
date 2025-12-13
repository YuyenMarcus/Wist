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
  // Visibility fields
  is_public: boolean;
  share_token: string | null;
  // Image source
  image_source?: 'url' | 'storage';
}

/**
 * Get all products for a specific user
 * For owners: shows all fields including reserved_by
 * For guests: reserved_by is hidden for owner's items
 */
export async function getUserProducts(userId: string, viewerId?: string): Promise<{
  data: SupabaseProduct[] | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error };

  // Hide reserved_by from owner (to avoid spoiling surprise)
  if (data) {
    data = data.map(product => {
      if (product.user_id === viewerId) {
        // Owner viewing their own list - hide who reserved it
        return { ...product, reserved_by: null };
      }
      return product;
    });
  }

  return { data, error };
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
    // Found by username, get public products
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_public', true)
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
 * Delete a product (with user verification)
 */
export async function deleteUserProduct(
  userId: string,
  productId: string
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('user_id', userId);

  return { error };
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
