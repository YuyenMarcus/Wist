/**
 * Lightweight static scraper using fetch + cheerio
 * No native dependencies - works with Vercel/Next.js
 */
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  title: string | null;
  description: string | null;
  image: string | null;
  priceRaw: string | null;
  url: string;
  html?: string;
}

export async function staticScrape(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
    },
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  // Title extraction
  let title = 
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="title"]').attr('content') ||
    $('title').text() ||
    null;

  // Image extraction
  let image =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="image"]').attr('content') ||
    null;

  // Description extraction
  let description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    null;

  // Price extraction from JSON-LD
  let priceRaw: string | null = null;
  
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonLd = JSON.parse($(el).html() || '');
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

      for (const item of items) {
        if (item && (item['@type'] === 'Product' || item['@type'] === 'Offer')) {
          const price = item.offers?.price || item.price;
          if (price !== undefined && price !== null) {
            priceRaw = String(price);
            return false; // Break
          }
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Fallback: regex search for price in meta tags
  if (!priceRaw) {
    const priceAmount = $('meta[property="product:price:amount"]').attr('content');
    if (priceAmount) {
      priceRaw = priceAmount;
    }
  }

  // Clean up
  title = title?.replace(/\s+/g, ' ').trim() || null;
  image = image?.startsWith('http') ? image : (image ? new URL(image, url).href : null);
  priceRaw = priceRaw?.trim() || null;
  description = description?.trim() || null;

  return {
    title,
    description,
    image,
    priceRaw,
    url,
    html,
  };
}
