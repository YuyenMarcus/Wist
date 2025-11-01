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
import { extractStructuredDataFromUrl, extractFromGoogleCache } from './google-cache';

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

  // --- Try 1: Lightweight Structured Data Extraction (Fast, Legal, No Bot Detection) ---
  // This is the preferred method - just fetch HTML and parse structured data
  try {
    const structured = await extractStructuredDataFromUrl(url);
    
    if (structured && structured.title && structured.title !== 'Unknown Item') {
      productData = {
        title: structured.title,
        image: structured.image,
        price: structured.price,
        description: structured.description,
      };
      console.log('✅ Extracted from structured data (fast, legal)');
    }
  } catch (err: any) {
    console.warn('Structured data extraction failed:', err.message);
  }

  // --- Try 2: Google Cached Results (Legal Fallback) ---
  if (!productData || !productData.title || productData.title === 'Unknown Item') {
    await delay(1000);
    try {
      const cached = await extractFromGoogleCache(url);
      if (cached && cached.title && cached.title !== 'Unknown Item') {
        productData = {
          title: cached.title,
          image: cached.image,
          price: cached.price,
          description: cached.description,
        };
        console.log('✅ Extracted from Google cache (legal fallback)');
      }
    } catch (err: any) {
      console.warn('Google cache extraction failed:', err.message);
    }
  }

  // --- Try 3: Playwright with Stealth (Only if structured data fails) ---
  if (!productData || !productData.title || productData.title === 'Unknown Item') {
    try {
      const playwrightResult = await playwrightScrape(url, false);
      
      productData = {
        title: playwrightResult.title,
        image: playwrightResult.image,
        price: playwrightResult.priceRaw,
        description: playwrightResult.description,
      };

      // Try structured data extraction from Playwright HTML if direct extraction failed
      if ((!productData.title || productData.title === 'Unknown Item') && playwrightResult.html) {
        const structured = extractStructuredData(playwrightResult.html);
        if (structured && structured.title && structured.title !== 'Unknown Item') {
          productData = {
            title: structured.title,
            image: structured.image,
            price: structured.price,
            description: structured.description,
          };
        }
      }

      if (productData.title && productData.title !== 'Unknown Item') {
        console.log('✅ Extracted with Playwright (full scrape)');
      }
    } catch (err: any) {
      console.warn('Playwright blocked or failed:', err.message);
    }
  }

  // --- Try 4: Static fetch fallback ---
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

