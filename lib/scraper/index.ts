/**
 * Main scraper orchestrator with caching and normalization
 */
import { isDynamic, extractDomain, cleanPrice, detectBlock, NormalizedProduct } from './utils';
import { staticScrape } from './static-scraper';
import { playwrightScrape } from './playwright-scraper';
import { scrapyScrape, checkScrapyAvailable } from './scrapy-scraper';

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

export type { ScrapeResponse };

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

    if (isDynamic(domain)) {
      // For Amazon and other bot-detection-heavy sites, try Scrapy first
      const isAmazon = domain.includes('amazon');
      const scrapyAvailable = await checkScrapyAvailable();
      
      if (isAmazon && scrapyAvailable) {
        try {
          console.log('Trying Scrapy for Amazon product...');
          data = await scrapyScrape({ url });
          if (data.title && data.title !== 'Unknown Item') {
            console.log('✅ Scrapy extraction successful');
          } else {
            throw new Error('Scrapy returned insufficient data');
          }
        } catch (scrapyErr: any) {
          console.warn('Scrapy failed, falling back to Playwright:', scrapyErr.message);
          // Fall through to Playwright
        }
      }
      
      // If Scrapy didn't work or wasn't tried, use Playwright
      if (!data || !data.title || data.title === 'Unknown Item') {
        try {
          data = await playwrightScrape(url, false);
        } catch (err: any) {
          console.error('Playwright desktop failed, trying mobile', err.message);
          // Try mobile user agent (often bypasses bot detection)
          try {
            data = await playwrightScrape(url, true);
          } catch (mobileErr: any) {
            console.error('Playwright mobile failed, trying static fallback', mobileErr.message);
            // Fallback to static scraping
            data = await staticScrape(url);
          }
        }
      }
    } else {
      data = await staticScrape(url);
    }

    // Block detection
    if (data.html && detectBlock(data.html)) {
      return {
        ok: false,
        error: 'Site blocking automated access; try again or use manual add.',
      };
    }

    // Normalize
    const title =
      data.title && typeof data.title === 'string'
        ? data.title.trim()
        : null;
    const price = data.priceRaw ? cleanPrice(data.priceRaw) : null;

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
    console.error('fetch-product error', err);
    return {
      ok: false,
      error: 'Unable to fetch product',
      detail: err.message,
    };
  }
}
