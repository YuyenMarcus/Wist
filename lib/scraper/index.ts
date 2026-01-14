/**
 * Main scraper orchestrator
 * Prefers Python Flask scraper service, falls back to static scraping
 */
import { extractDomain, cleanPrice, NormalizedProduct } from './utils';
import { staticScrape } from './static-scraper';
import { scrapeSync, checkServiceHealth } from '../scraper-service-client';

export interface ScrapeOptions {
  url: string;
  useCache?: boolean;
}

export interface ScrapeResponse {
  ok: boolean;
  data?: NormalizedProduct;
  error?: string;
  detail?: string;
}

export async function scrapeProduct(
  url: string,
  options: { useCache?: boolean } = {}
): Promise<ScrapeResponse> {
  const domain = extractDomain(url);

  if (!domain) {
    return {
      ok: false,
      error: 'Invalid URL',
    };
  }

  try {
    let data;

    // Try Python scraper service first (most reliable)
    const serviceAvailable = await checkServiceHealth();
    
    if (serviceAvailable) {
      try {
        console.log('[Scraper] Using Python scraper service...');
        const response = await scrapeSync(url);
        
        if (response.success && response.result) {
          data = response.result;
          console.log('[Scraper] Python service succeeded:', data.title?.substring(0, 50));
        }
      } catch (serviceErr: any) {
        console.warn('[Scraper] Python service failed:', serviceErr.message);
        // Fall through to static scraper
      }
    }

    // Fallback to static scraping (cheerio - lightweight, no browser)
    if (!data || !data.title || data.title === 'Unknown Item') {
      console.log('[Scraper] Using static scraper fallback...');
      data = await staticScrape(url);
    }

    // Normalize the result
    const title =
      data.title && typeof data.title === 'string'
        ? data.title.trim()
        : null;
    const price = data.priceRaw ? cleanPrice(data.priceRaw) : (data.price || null);

    // Extract currency from priceRaw
    const currencyMatch = data.priceRaw?.match(/[A-Z]{3}/);
    const currency = currencyMatch ? currencyMatch[0] : null;

    const normalized: NormalizedProduct = {
      title: title || 'Unknown Item',
      price,
      priceRaw: data.priceRaw || null,
      currency,
      image: data.image || null,
      domain,
      url,
      description: data.description || null,
    };

    return {
      ok: true,
      data: normalized,
    };
  } catch (err: any) {
    console.error('[Scraper] Error:', err.message);
    return {
      ok: false,
      error: 'Unable to fetch product',
      detail: err.message,
    };
  }
}
