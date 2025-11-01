/**
 * Smart retry scraper with Supabase integration
 * Tries: Playwright → Static → Manual fallback
 * Automatically saves to Supabase wishlist_items
 */
import { chromium as chromiumExtra } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import { JSDOM } from 'jsdom';
import { createClient } from '@supabase/supabase-js';
import { playwrightScrape } from './playwright-scraper';
import { staticScrape } from './static-scraper';
import { extractDomain } from './utils';
import { extractAll, extractStructuredData, extractMetaData } from './structured-data';

// Apply stealth plugin
chromiumExtra.use(StealthPlugin());

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

// Helper: Delay function
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

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
  if (!title) return 'Unknown Item';
  
  return title
    .replace(/\s+/g, ' ')
    .replace(/[-|•].*$/, '')
    .trim();
}

// Helper: Normalize domain
function cleanDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

// Helper: Extract JSON-LD from document
function extractJsonLD(doc: Document): any {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  
  for (const el of scripts) {
    try {
      const data = JSON.parse(el.textContent || '');
      if (data?.offers?.price || data?.price) {
        return data;
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  return null;
}

// Helper: Static scrape with fetch using Cheerio for structured data
async function staticFetchScrape(url: string): Promise<{
  title: string | null;
  image: string | null;
  price: string | number | null;
  description: string | null;
} | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
    });

    const html = await res.text();
    
    // Use Cheerio-based extraction (more reliable for structured data)
    const extracted = extractAll(html);
    
    return {
      title: extracted.title,
      image: extracted.image,
      price: extracted.price,
      description: extracted.description,
    };
  } catch (err: any) {
    console.error('Static fetch scrape failed:', err.message);
    return null;
  }
}

/**
 * Main function: Scrape and save product to Supabase
 * Smart retry: Playwright → Static → Manual fallback
 */
export async function scrapeAndSaveProduct(
  url: string,
  userId: string | null = null
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  const domain = cleanDomain(url);
  let productData: {
    title: string | null;
    image: string | null;
    price: string | number | null;
    description: string | null;
  } | null = null;

  // --- Try 1: Playwright with Stealth ---
  try {
    const playwrightResult = await playwrightScrape(url, false);
    
    productData = {
      title: playwrightResult.title,
      image: playwrightResult.image,
      price: playwrightResult.priceRaw,
      description: playwrightResult.description,
    };

    // Only proceed if we got meaningful data
    if (productData.title && productData.title !== 'Unknown Item') {
      // Success - continue to normalization
    } else {
      // Try to extract from HTML using structured data
      if (playwrightResult.html) {
        const structured = extractStructuredData(playwrightResult.html);
        if (structured && structured.title && structured.title !== 'Unknown Item') {
          productData = {
            title: structured.title,
            image: structured.image,
            price: structured.price,
            description: structured.description,
          };
        } else {
          throw new Error('Playwright returned insufficient data');
        }
      } else {
        throw new Error('Playwright returned insufficient data');
      }
    }
  } catch (err: any) {
    console.warn('Playwright blocked or failed, retrying with structured data extraction...', err.message);
  }

  // --- Try 2: Static fetch fallback ---
  if (!productData || !productData.title || productData.title === 'Unknown Item') {
    await delay(1500);
    productData = await staticFetchScrape(url);
  }

  // --- Try 3: Final fallback (manual input) ---
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
  const description = productData.description?.trim() || null;

  const product = {
    title,
    price: price || null,
    price_raw: productData.price ? String(productData.price) : null,
    image,
    description,
    domain,
    url,
    user_id: userId,
    meta: {
      scraped_at: new Date().toISOString(),
      method: productData.title === 'Unknown Item' ? 'manual_fallback' : 'scraped',
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
      data: data || product, // Return inserted data or fallback to product object
    };
  } catch (err: any) {
    console.error('Supabase insert failed:', err);
    return {
      success: false,
      error: err.message || 'Failed to save to Supabase',
    };
  }
}

