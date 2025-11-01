/**
 * Fallback API services for product scraping
 * Free public APIs as backup when Playwright fails
 */

import fetch from 'node-fetch';
import { ScrapeResult } from './static-scraper';

interface FallbackApiResponse {
  success: boolean;
  data?: ScrapeResult;
  error?: string;
}

/**
 * Try ScraperAPI (free demo)
 * https://api.scraperapi.com/demo?url=...
 */
export async function tryScraperAPI(url: string): Promise<FallbackApiResponse> {
  try {
    const apiUrl = `https://api.scraperapi.com/demo?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return { success: false, error: `ScraperAPI returned ${response.status}` };
    }

    const html = await response.text();

    // Extract JSON-LD from HTML
    const result = extractFromHtml(html, url);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Extract product data from Google Shopping
 * https://www.google.com/search?tbm=shop&q=product+name
 */
export async function tryGoogleShopping(productName: string): Promise<FallbackApiResponse> {
  try {
    const searchUrl = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(productName)}`;
    const response = await fetch(searchUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return { success: false, error: `Google Shopping returned ${response.status}` };
    }

    const html = await response.text();
    const result = extractFromHtml(html, searchUrl);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Extract product data from HTML string (JSON-LD and meta tags)
 */
function extractFromHtml(html: string, url: string): ScrapeResult {
  let title: string | null = null;
  let image: string | null = null;
  let priceRaw: string | null = null;
  let description: string | null = null;

  // Extract JSON-LD
  try {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

      for (const item of arr) {
        if (item && (item['@type'] === 'Product' || item['@type'] === 'Offer')) {
          if (item.name && typeof item.name === 'string') {
            title = item.name;
          }
          if (item.image) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            if (typeof img === 'string') image = img;
          }
          if (item.offers?.price) {
            priceRaw = String(item.offers.price);
          } else if (item.price) {
            priceRaw = String(item.price);
          }
          if (item.description && typeof item.description === 'string') {
            description = item.description;
          }
        }
      }
    }
  } catch (e) {
    // Ignore JSON-LD parse errors
  }

  // Extract from meta tags if JSON-LD didn't work
  if (!title) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (titleMatch) title = titleMatch[1];
  }

  if (!image) {
    const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (imageMatch) image = imageMatch[1];
  }

  if (!description) {
    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    if (descMatch) description = descMatch[1];
  }

  return {
    title: title?.trim() || null,
    image: image || null,
    priceRaw: priceRaw?.trim() || null,
    description: description?.trim() || null,
    url,
    html,
  };
}

