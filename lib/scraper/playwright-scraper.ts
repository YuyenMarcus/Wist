/**
 * Playwright-based scraper for dynamic sites with stealth plugin
 * Uses multiple strategies: stealth plugin, mobile user agents, JSON-LD extraction
 * Enhanced with JSDOM for reliable HTML parsing and Cheerio for structured data
 */
import { chromium as chromiumExtra } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import type { Browser } from 'playwright';
import { JSDOM } from 'jsdom';
import { ScrapeResult } from './static-scraper';
import { extractStructuredData } from './structured-data';

// Apply stealth plugin to bypass bot detection
chromiumExtra.use(StealthPlugin());

// Multiple user agents for rotation and mobile fallback
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Extract product data from HTML using JSDOM (more reliable than regex)
 * Uses structured data (JSON-LD) → meta tags → regex fallback
 */
function extractDataFromHtml(html: string, url: string): ScrapeResult {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // --- TITLE ---
  let title: string | null =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('title')?.textContent ||
    null;

  // --- IMAGE ---
  let image: string | null =
    doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
    doc.querySelector('img')?.getAttribute('src') ||
    null;

  // --- PRICE ---
  // Try structured JSON-LD first
  let priceRaw: string | null = null;

  const jsonLdScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of jsonLdScripts) {
    try {
      const jsonLd = JSON.parse(script.textContent || '');
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

      for (const item of items) {
        if (item && (item['@type'] === 'Product' || item['@type'] === 'Offer')) {
          // Try offers.price, then price
          if (item.offers?.price) {
            priceRaw = String(item.offers.price);
            break;
          } else if (item.price) {
            priceRaw = String(item.price);
            break;
          }
        }
      }
      if (priceRaw) break;
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Fallback: regex search for price in text ($XX.XX format)
  if (!priceRaw) {
    const bodyText = doc.body?.textContent || '';
    const priceMatch = bodyText.match(/\$[0-9,.]+/);
    if (priceMatch) {
      priceRaw = priceMatch[0];
    }
  }

  // --- DESCRIPTION ---
  let description: string | null =
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
    null;

  // --- CLEANUP ---
  title = title?.replace(/\s+/g, ' ').trim() || null;
  image = image?.startsWith('http') ? image : (image ? new URL(image, url).href : null);
  priceRaw = priceRaw?.trim() || null;
  description = description?.trim() || null;

  return {
    title,
    image,
    priceRaw,
    description,
    url,
    html,
  };
}

/**
 * Try scraping with mobile user agent (lighter, fewer bot defenses)
 */
async function tryMobileScrape(url: string, browser: Browser): Promise<ScrapeResult | null> {
  try {
    const context = await browser.newContext({
      userAgent: MOBILE_USER_AGENT,
      viewport: { width: 375, height: 667 }, // iPhone size
      locale: 'en-US',
      timezoneId: 'America/New_York',
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await page.waitForTimeout(2000); // Let scripts load

    const html = await page.content();
    await context.close();

    // Extract data from mobile HTML
    return await extractDataFromHtml(html, url);
  } catch {
    return null;
  }
}

export async function playwrightScrape(url: string, useMobile: boolean = false): Promise<ScrapeResult> {
  let browser: Browser | null = null;

  try {
    browser = await chromiumExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    // Try mobile first if requested (often bypasses bot detection)
    if (useMobile) {
      const mobileResult = await tryMobileScrape(url, browser);
      if (mobileResult) {
        // Extract data from mobile HTML
        return await extractDataFromHtml(mobileResult.html || '', url);
      }
    }

    const context = await browser.newContext({
      userAgent: DESKTOP_USER_AGENT,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
    });

    const page = await context.newPage();

    // Set common headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for scripts to load (important for dynamic content)
    await page.waitForTimeout(2000);
    await page.mouse.move(
      100 + Math.floor(Math.random() * 200),
      100 + Math.floor(Math.random() * 200)
    );

    // Wait for network to quiet
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // Ignore timeout, continue anyway
    });

    const html = await page.content();
    await context.close();
    await browser.close();
    browser = null;

    // First try JSDOM extraction
    let result = extractDataFromHtml(html, url);
    
    // If title is missing or "Unknown Item", try structured data extraction (Cheerio)
    if (!result.title || result.title === 'Unknown Item') {
      const structured = extractStructuredData(html);
      if (structured && structured.title && structured.title !== 'Unknown Item') {
        result = {
          title: structured.title || result.title,
          image: structured.image || result.image,
          priceRaw: structured.price ? String(structured.price) : result.priceRaw,
          description: structured.description || result.description,
          url,
          html,
        };
      }
    }
    
    return result;
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    throw err;
  }
}
