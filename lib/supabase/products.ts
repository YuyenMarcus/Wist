/**
 * Supabase products operations with user filtering
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
}

/**
 * Get all products for a specific user
 */
export async function getUserProducts(userId: string): Promise<{
  data: SupabaseProduct[] | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)  // 👈 Filter by user_id
    .order('created_at', { ascending: false });

  return { data, error };
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
    .eq('user_id', userId);  // Double security - ensure user owns the item

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

