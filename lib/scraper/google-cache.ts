/**
 * Google Cached Results Parser
 * Extracts product data from Google's cached pages
 * Legal, fast, and doesn't trigger bot detection
 */
import * as cheerio from 'cheerio';
import { StructuredData, extractAll } from './structured-data';

/**
 * Get Google cached URL for a given URL
 */
export function getGoogleCacheUrl(url: string): string {
  return `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
}

/**
 * Extract product data from Google cached page
 */
export async function extractFromGoogleCache(url: string): Promise<StructuredData | null> {
  try {
    const cacheUrl = getGoogleCacheUrl(url);
    
    const response = await fetch(cacheUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Extract using structured data (works well with cached pages)
    return extractAll(html);
  } catch (err: any) {
    console.error('Google cache extraction failed:', err.message);
    return null;
  }
}

/**
 * Try to extract structured data directly from URL without full scraping
 * Uses lightweight fetch + structured data parsing
 */
export async function extractStructuredDataFromUrl(url: string): Promise<StructuredData | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Extract structured data (JSON-LD + meta tags)
    // This works even if JavaScript is blocked
    return extractAll(html);
  } catch (err: any) {
    console.error('Structured data extraction failed:', err.message);
    return null;
  }
}

