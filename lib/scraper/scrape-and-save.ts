/**
 * Smart retry scraper with Supabase integration
 * Primary: Python scraper service → Fallback: Static scraping
 */
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { staticScrape } from './static-scraper';
import { extractDomain } from './utils';
import { extractStructuredData } from './structured-data';
import { scrapeSync, checkServiceHealth } from '../scraper-service-client';

// Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper: Normalize price
function cleanPrice(raw: string | number | null): number | null {
  if (!raw) return null;
  
  const str = String(raw);
  const num = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(num);
  
  return isNaN(parsed) ? null : parseFloat(parsed.toFixed(2));
}

// Helper: Normalize title
function cleanTitle(title: string | null): string {
  if (!title || title === 'Unknown Item') return 'Unknown Item';
  return title.replace(/\s+/g, ' ').replace(/[-|•].*$/, '').trim();
}

// Helper: Normalize domain
function cleanDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

/**
 * Simple scraper function - just returns product data without saving
 * This is the main function to use in API routes
 */
export async function scrapeAndSave(url: string): Promise<{
  title: string;
  price: string | number | null;
  priceRaw?: string | null;
  image: string | null;
  description: string | null;
  domain: string;
  url: string;
}> {
  const domain = cleanDomain(url);
  let productData: {
    title: string | null;
    image: string | null;
    price: string | number | null;
    description: string | null;
  } | null = null;

  // --- Try 1: Python Scraper Service (Most Reliable) ---
  try {
    const serviceAvailable = await checkServiceHealth();
    
    if (serviceAvailable) {
      console.log('[scrape-and-save] Using Python scraper service...');
      const response = await scrapeSync(url);
      
      if (response.success && response.result) {
        productData = {
          title: response.result.title,
          image: response.result.image,
          price: response.result.price || response.result.priceRaw,
          description: response.result.description,
        };
        console.log('✅ Extracted via Python scraper service');
      }
    }
  } catch (err: any) {
    console.warn('Python scraper service failed:', err.message);
  }

  // --- Try 2: Static Scraping (Lightweight Fallback) ---
  if (!productData || !productData.title || productData.title === 'Unknown Item') {
    try {
      console.log('[scrape-and-save] Using static scraper fallback...');
      const staticResult = await staticScrape(url);
      
      if (staticResult && staticResult.title) {
        productData = {
          title: staticResult.title,
          image: staticResult.image,
          price: staticResult.priceRaw,
          description: staticResult.description,
        };
        
        // Try structured data extraction from HTML
        if (staticResult.html && (!productData.title || productData.title === 'Unknown Item')) {
          const structured = extractStructuredData(staticResult.html);
          if (structured && structured.title && structured.title !== 'Unknown Item') {
            productData = {
              title: structured.title,
              image: structured.image || productData.image,
              price: structured.price || productData.price,
              description: structured.description || productData.description,
            };
          }
        }
        
        console.log('✅ Extracted via static scraper');
      }
    } catch (err: any) {
      console.warn('Static scraper failed:', err.message);
    }
  }

  // --- Final fallback (manual input) ---
  if (!productData) {
    productData = {
      title: 'Unknown Item',
      image: '',
      price: null,
      description: null,
    };
  }

  // --- Normalize data ---
  const title = cleanTitle(productData.title);
  const image = productData.image?.startsWith('http')
    ? productData.image
    : productData.image
    ? new URL(productData.image, url).href
    : '';
  const price = cleanPrice(productData.price);
  const priceRaw = productData.price ? String(productData.price) : null;
  const description = productData.description?.trim() || null;

  return {
    title,
    price: price || priceRaw || null,
    priceRaw,
    image,
    description,
    domain,
    url,
  };
}

/**
 * Main function: Scrape and save product to Supabase
 */
export async function scrapeAndSaveProduct(
  url: string,
  userId: string | null = null
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const scraped = await scrapeAndSave(url);

  const product = {
    title: scraped.title,
    price: cleanPrice(scraped.price) || null,
    price_raw: scraped.priceRaw || null,
    image: scraped.image,
    description: scraped.description,
    domain: scraped.domain,
    url: scraped.url,
    user_id: userId,
    meta: {
      scraped_at: new Date().toISOString(),
      method: scraped.title === 'Unknown Item' ? 'manual_fallback' : 'scraped',
    },
  };

  // --- Save to Supabase ---
  const supabase = getSupabase();
  
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase not configured. Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    };
  }

  try {
    const { data, error } = await supabase
      .from('wishlist_items')
      .insert([product])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: data || product,
    };
  } catch (err: any) {
    console.error('Supabase insert failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to save to Supabase',
    };
  }
}
