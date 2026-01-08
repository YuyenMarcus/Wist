// pages/api/fetch-product.ts
// Updated to use Python Flask microservice with Supabase caching

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase/client';

// Use server-side env var (not NEXT_PUBLIC_* since this is server-only)
const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set JSON header immediately to prevent HTML error pages
  res.setHeader('Content-Type', 'application/json');

  // Wrap entire handler in try/catch to prevent HTML error pages
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { url, user_id } = req.body || {};
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing URL in request body' });
    }

    // TODO: Get user_id from authentication (session, JWT, etc.)
    // For now, accept user_id from request body
    // In production, extract from: req.headers.authorization or req.session.user.id

    // --- 1. CHECK SUPABASE CACHE FIRST (if configured) ---
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: cachedProducts, error: cacheError } = await supabase
          .from('products')
          .select('*')
          .eq('url', url)
          .limit(1)
          .single();

        if (!cacheError && cachedProducts) {
          // Check if cache is fresh (less than 6 hours old)
          const lastScraped = cachedProducts.last_scraped 
            ? new Date(cachedProducts.last_scraped)
            : null;
          
          if (lastScraped) {
            const ageHours = (Date.now() - lastScraped.getTime()) / (1000 * 60 * 60);
            
            if (ageHours < 6) {
              console.log(`✅ [fetch-product] Cache hit: ${cachedProducts.title?.substring(0, 50)}... (age: ${ageHours.toFixed(1)}h)`);
              
              return res.status(200).json({
                success: true,
                title: cachedProducts.title || 'Unknown Item',
                price: cachedProducts.price || null,
                priceRaw: cachedProducts.price_raw || cachedProducts.price || null,
                image: cachedProducts.image || '',
                description: cachedProducts.description || null,
                domain: cachedProducts.domain || new URL(url).hostname.replace('www.', ''),
                url: cachedProducts.url || url,
                source: 'cache', // Let frontend know it was cached
              });
            } else {
              console.log(`⚠️  [fetch-product] Cache expired (${ageHours.toFixed(1)}h old), re-scraping...`);
            }
          }
        }
      }
    } catch (cacheErr: any) {
      // Don't fail if cache check fails, just log and continue
      console.warn('[fetch-product] Cache check failed:', cacheErr?.message);
    }

    // --- 2. IF NOT IN CACHE, CALL SCRAPER SERVICE TO SCRAPE ---
    try {
      // Try Railway scraper service first (if configured)
      if (SCRAPER_SERVICE_URL && SCRAPER_SERVICE_URL !== 'http://localhost:5000') {
        console.log(`[fetch-product] Calling Railway scraper: ${SCRAPER_SERVICE_URL}/api/scrape/sync`);
        
        try {
          const response = await fetch(`${SCRAPER_SERVICE_URL}/api/scrape/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              url,
              user_id
            }),
            signal: AbortSignal.timeout(30000) // 30s timeout
          });

          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.result) {
              const result = data.result;
              
              // Map Flask response to frontend format
              let priceRaw = result.priceRaw;
              if (!priceRaw && result.price) {
                priceRaw = `$${parseFloat(String(result.price)).toFixed(2)}`;
              } else if (priceRaw && !priceRaw.startsWith('$')) {
                priceRaw = priceRaw.replace(/^\$?/, '$');
              }
              
              return res.status(200).json({
                success: true,
                title: result.title || 'Unknown Item',
                price: result.price || null,
                priceRaw: priceRaw || null,
                image: result.image || '',
                description: result.description || null,
                domain: result.domain || new URL(url).hostname.replace('www.', ''),
                url: result.url || url,
              });
            }
          }
        } catch (railwayError: any) {
          console.warn('[fetch-product] Railway scraper failed, falling back to local scraper:', railwayError.message);
          // Fall through to local scraper
        }
      }
      
      // Fallback to local scraper
      console.log('[fetch-product] Using local scraper fallback');
      const { scrapeProduct } = await import('@/lib/scraper');
      const scraped = await scrapeProduct(url);
      
      if (!scraped) {
        throw new Error('Failed to scrape product');
      }
      
      return res.status(200).json({
        success: true,
        title: scraped.title || 'Unknown Item',
        price: scraped.current_price || null,
        priceRaw: scraped.current_price ? `$${scraped.current_price.toFixed(2)}` : null,
        image: scraped.image_url || '',
        description: null,
        domain: scraped.retailer || new URL(url).hostname.replace('www.', ''),
        url: url,
      });
      
    } catch (error: any) {
      console.error('[fetch-product] Scrape error:', error);
      
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch product',
      });
    }
  } catch (outerErr: any) {
    // This catches ANY error
    console.error('[fetch-product] Fatal error:', outerErr);
    
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching product',
      detail: outerErr?.message || String(outerErr),
    });
  }
}
