/**
 * Wishlist operations with Supabase
 */
import { supabase } from './client';
import { NormalizedProduct } from '@/lib/scraper/utils';

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string | null;
  description: string | null;
  price: number | null;
  price_raw: string | null;
  currency: string | null;
  image: string | null;
  domain: string | null;
  url: string;
  meta: Record<string, any> | null;
  created_at: string;
}

export async function saveWishlistItem(
  userId: string,
  product: NormalizedProduct,
  metadata?: Record<string, any>
): Promise<{ data: WishlistItem | null; error: any }> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .insert({
      user_id: userId,
      title: product.title,
      description: product.description,
      price: product.price,
      price_raw: product.priceRaw,
      currency: product.currency,
      image: product.image,
      domain: product.domain,
      url: product.url,
      meta: metadata || null,
    })
    .select()
    .single();

  return { data, error };
}

export async function getWishlistItems(userId: string): Promise<{
  data: WishlistItem[] | null;
  error: any;
}> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function deleteWishlistItem(
  userId: string,
  itemId: string
): Promise<{ error: any }> {
  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId); // Ensure user owns the item

  return { error };
}

export async function updateWishlistItem(
  userId: string,
  itemId: string,
  updates: Partial<WishlistItem>
): Promise<{ data: WishlistItem | null; error: any }> {
  const { data, error } = await supabase
    .from('wishlist_items')
    .update(updates)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();

  return { data, error };
}
