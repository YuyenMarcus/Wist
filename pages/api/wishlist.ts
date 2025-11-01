/**
 * API endpoint for wishlist operations
 * POST /api/wishlist - Save item
 * GET /api/wishlist - Get all items
 * DELETE /api/wishlist?id=xxx - Delete item
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  saveWishlistItem,
  getWishlistItems,
  deleteWishlistItem,
} from '@/lib/supabase/wishlist';
import { NormalizedProduct } from '@/lib/scraper/utils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // TODO: Add authentication middleware to get userId from session/token
  // For now, using a placeholder - replace with actual auth
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const product = req.body as NormalizedProduct;

    if (!product || !product.url) {
      return res.status(400).json({ error: 'Invalid product data' });
    }

    const { data, error } = await saveWishlistItem(userId, product, req.body.meta);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ ok: true, data });
  }

  if (req.method === 'GET') {
    const { data, error } = await getWishlistItems(userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing item id' });
    }

    const { error } = await deleteWishlistItem(userId, id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
