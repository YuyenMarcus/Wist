/**
 * Playwright-based scraper for dynamic sites
 * Uses multiple strategies: mobile user agents, JSON-LD extraction
 * Enhanced with Cheerio for reliable HTML parsing and structured data
 * Includes platform-specific selectors for Amazon, eBay, BestBuy, Target, Walmart, Etsy
 */
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { ScrapeResult } from './static-scraper';
import { extractStructuredData } from './structured-data';

// Multiple user agents for rotation and mobile fallback
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Safe selector evaluation with fallback
 * Gracefully handles missing selectors without throwing errors
 */
async function safeEval(page: Page, selector: string, fallback: string = ''): Promise<string> {
  try {
    return await page.$eval(selector, (el: Element) => {
      if (el instanceof HTMLElement) {
        return el.textContent?.trim() || '';
      }
      return el.getAttribute('textContent') || el.getAttribute('content') || '';
    });
  } catch {
    return fallback;
  }
}

/**
 * Safe attribute evaluation with fallback
 * Gracefully handles missing selectors and extracts attributes
 */
async function safeAttr(page: Page, selector: string, attribute: string, fallback: string = ''): Promise<string> {
  try {
    return await page.$eval(selector, (el: Element, attr: string) => {
      return el.getAttribute(attr) || '';
    }, attribute);
  } catch {
    return fallback;
  }
}

/**
 * Platform-specific extraction using Playwright page.evaluate()
 * Returns extracted data or null if selectors don't match
 */
async function extractPlatformSpecific(page: Page, source: string): Promise<{
  title: string | null;
  price: string | null;
  image: string | null;
  rating: string | null;
} | null> {
  try {
    if (source.includes('amazon')) {
      // Wait for Amazon-specific elements
      try {
        await page.waitForSelector('#productTitle, .a-price, #landingImage', { timeout: 5000 }).catch(() => {});
      } catch {}

      // Use safeEval for graceful fallbacks
      const title = await safeEval(page, '#productTitle', 'Unknown Product');
      
      // Try multiple price selectors with fallbacks
      let price = await safeEval(page, '.a-price .a-offscreen', '');
      if (!price) {
        price = await safeEval(page, '.a-price-whole', '');
      }
      if (price) {
        price = price.replace(/[^0-9.,]/g, '');
      }

      // Try multiple image selectors with fallbacks
      let image = await safeAttr(page, '#landingImage', 'src', '');
      if (!image) {
        image = await safeAttr(page, '#landingImage', 'data-old-hires', '');
      }
      if (!image) {
        image = await safeAttr(page, '#imgBlkFront', 'src', '');
      }

      const rating = await safeEval(page, '.a-icon-alt', '');
      const ratingValue = rating ? rating.split(' ')[0] : null;

      if (title && title !== 'Unknown Product') {
        return {
          title: title || null,
          price: price || null,
          image: image || null,
          rating: ratingValue,
        };
      }
    } else if (source.includes('ebay')) {
      // Wait for eBay-specific elements
      try {
        await page.waitForSelector('#itemTitle, #prcIsum, #icImg', { timeout: 5000 }).catch(() => {});
      } catch {}

      // Try primary selectors first, then fallback
      let title = await safeEval(page, '#itemTitle', '');
      if (!title) {
        title = await safeEval(page, 'h1#x-item-title-label', '');
      }
      title = title.replace('Details about', '').trim();

      let price = await safeEval(page, '#prcIsum', '');
      if (!price) {
        price = await safeEval(page, '.notranslate[itemprop="price"]', '');
      }
      if (price) {
        price = price.replace(/[^0-9.,]/g, '');
      }

      let image = await safeAttr(page, '#icImg', 'src', '');
      if (!image) {
        image = await safeAttr(page, '#vi_main_img_fs', 'src', '');
      }

      const rating = await safeEval(page, '.reviews-seeall-hdn', '');
      const ratingValue = rating ? rating.split(' ')[0] : null;

      if (title && title !== 'Unknown Product') {
        return {
          title: title || null,
          price: price || null,
          image: image || null,
          rating: ratingValue,
        };
      }
    } else if (source.includes('bestbuy')) {
      try {
        await page.waitForSelector('.priceView-price, h1.heading-5', { timeout: 5000 }).catch(() => {});
      } catch {}

      let title = await safeEval(page, 'h1.heading-5', '');
      if (!title) {
        title = await safeEval(page, '[data-testid="product-title"]', '');
      }

      let price = await safeEval(page, '.priceView-price', '');
      if (!price) {
        price = await safeEval(page, '[data-testid="price"]', '');
      }
      if (price) {
        price = price.replace(/[^0-9.,]/g, '');
      }

      let image = await safeAttr(page, '[data-testid="product-image"] img', 'src', '');
      if (!image) {
        image = await safeAttr(page, '.product-image img', 'src', '');
      }

      if (title && title !== 'Unknown Product') {
        return {
          title: title || null,
          price: price || null,
          image: image || null,
          rating: null,
        };
      }
    } else if (source.includes('target')) {
      try {
        await page.waitForSelector('[data-test="product-title"], [data-test="product-price"]', { timeout: 5000 }).catch(() => {});
      } catch {}

      const title = await safeEval(page, 'h1[data-test="product-title"]', 'Unknown Product');

      let price = await safeEval(page, '[data-test="product-price"]', '');
      if (!price) {
        price = await safeEval(page, '[data-test="price-current"]', '');
      }
      if (price) {
        price = price.replace(/[^0-9.,]/g, '');
      }

      const image = await safeAttr(page, '[data-test="product-image"] img', 'src', '');

      if (title && title !== 'Unknown Product') {
        return {
          title: title || null,
          price: price || null,
          image: image || null,
          rating: null,
        };
      }
    } else if (source.includes('walmart')) {
      try {
        await page.waitForSelector('h1.prod-ProductTitle, [itemprop="price"]', { timeout: 5000 }).catch(() => {});
      } catch {}

      let title = await safeEval(page, 'h1.prod-ProductTitle', '');
      if (!title) {
        title = await safeEval(page, '[data-testid="product-title"]', '');
      }

      let price = await safeEval(page, '[itemprop="price"]', '');
      if (!price) {
        price = await safeEval(page, '.price-current', '');
      }
      if (price) {
        price = price.replace(/[^0-9.,]/g, '');
      }

      let image = await safeAttr(page, '[data-testid="product-image"] img', 'src', '');
      if (!image) {
        image = await safeAttr(page, '[itemprop="image"]', 'src', '');
      }

      if (title && title !== 'Unknown Product') {
        return {
          title: title || null,
          price: price || null,
          image: image || null,
          rating: null,
        };
      }
    } else if (source.includes('etsy.com')) {
      // Etsy-specific extraction
      try {
        await page.waitForSelector('.listing-page-title, .wt-text-body-01, img[src*="etsystatic.com"]', { timeout: 8000 }).catch(() => {});
      } catch {}

      // Title extraction
      let title = await safeEval(page, 'h1.listing-page-title', '');
      if (!title) {
        title = await safeEval(page, 'h1[data-buy-box-listing-title]', '');
      }
      if (!title) {
        title = await safeEval(page, 'h1.wt-text-body-01', '');
      }

      // Price extraction
      let price = await safeEval(page, '.wt-text-title-03 .currency-value', '');
      if (!price) {
        price = await safeEval(page, '[data-buy-box-region="price"] .currency-value', '');
      }
      if (!price) {
        price = await safeEval(page, '.wt-text-title-03', '');
      }
      if (price) {
        price = price.replace(/[^0-9.,]/g, '');
      }

      // Image extraction - Etsy uses lazy loading and specific patterns
      // FIRST: Try og:image meta tag (most reliable for Etsy)
      let image = await safeAttr(page, 'meta[property="og:image"]', 'content', '');
      
      // If og:image not found or invalid, try DOM selectors
      if (!image || !image.includes('etsystatic.com')) {
        image = await safeAttr(page, '.listing-page-image img', 'src', '');
      }
      if (!image || !image.includes('etsystatic.com')) {
        image = await safeAttr(page, '.listing-page-image img', 'data-src', '');
      }
      if (!image || !image.includes('etsystatic.com')) {
        image = await safeAttr(page, '.listing-page-image img', 'data-image-url', '');
      }
      if (!image || !image.includes('etsystatic.com')) {
        image = await safeAttr(page, '[data-carousel-first-image] img', 'src', '');
      }
      if (!image || !image.includes('etsystatic.com')) {
        image = await safeAttr(page, '[data-carousel-first-image] img', 'data-src', '');
      }
      if (!image || !image.includes('etsystatic.com')) {
        // Try JSON-LD structured data
        const jsonLdImage = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script[type="application/ld+json"]');
          for (const script of scripts) {
            try {
              const data = JSON.parse(script.textContent || '{}');
              const items = Array.isArray(data) ? data : [data];
              for (const item of items) {
                if (item['@type'] === 'Product' && item.image) {
                  let imgUrl = Array.isArray(item.image) ? item.image[0] : item.image;
                  if (typeof imgUrl === 'object' && imgUrl.url) {
                    imgUrl = imgUrl.url;
                  }
                  if (imgUrl && typeof imgUrl === 'string' && imgUrl.includes('etsystatic.com')) {
                    return imgUrl;
                  }
                }
              }
            } catch (e) {}
          }
          return null;
        });
        if (jsonLdImage) {
          image = jsonLdImage;
        }
      }
      if (!image || !image.includes('etsystatic.com')) {
        // Try finding any Etsy image
        const foundImage = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img[src*="etsystatic.com"], img[data-src*="etsystatic.com"]'));
          for (const img of imgs) {
            const src = (img as HTMLImageElement).src || (img as HTMLImageElement).getAttribute('data-src');
            if (src && src.includes('/il/') && !src.includes('placeholder') && !src.includes('avatar')) {
              return src.replace(/\/\d+x\d+\//, '/').replace(/\/\d+x\d+\./, '.').split('?')[0];
            }
          }
          return null;
        });
        if (foundImage) {
          image = foundImage;
        }
      }
      
      // Clean up image URL to get higher resolution (only if it's an etsystatic.com URL)
      if (image && image.includes('etsystatic.com')) {
        image = image.replace(/\/\d+x\d+\//, '/').replace(/\/\d+x\d+\./, '.').split('?')[0];
      }

      if (title && title !== 'Unknown Product') {
        return {
          title: title || null,
          price: price || null,
          image: image || null,
          rating: null,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn('Platform-specific extraction failed:', err);
    return null;
  }
}

/**
 * Extract product data from HTML using Cheerio (ESM-compatible)
 * Uses structured data (JSON-LD) → meta tags → regex fallback
 */
function extractDataFromHtml(html: string, url: string): ScrapeResult {
  const $ = cheerio.load(html);

  // --- TITLE ---
  let title: string | null =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text() ||
    null;

  // --- IMAGE ---
  let image: string | null =
    $('meta[property="og:image"]').attr('content') ||
    $('img').first().attr('src') ||
    null;

  // --- PRICE ---
  // Try structured JSON-LD first
  let priceRaw: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonLd = JSON.parse($(el).html() || '');
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

      for (const item of items) {
        if (item && (item['@type'] === 'Product' || item['@type'] === 'Offer')) {
          // Try offers.price, then price
          if (item.offers?.price) {
            priceRaw = String(item.offers.price);
            return false; // Break the loop
          } else if (item.price) {
            priceRaw = String(item.price);
            return false; // Break the loop
          }
        }
      }
      if (priceRaw) return false; // Break the loop
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Fallback: regex search for price in text ($XX.XX format)
  if (!priceRaw) {
    const bodyText = $('body').text() || '';
    const priceMatch = bodyText.match(/\$[0-9,.]+/);
    if (priceMatch) {
      priceRaw = priceMatch[0];
    }
  }

  // --- DESCRIPTION ---
  let description: string | null =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
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
    browser = await chromium.launch({
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

    // Try platform-specific extraction first (more accurate for known sites)
    const source = new URL(url).hostname.toLowerCase();
    const platformData = await extractPlatformSpecific(page, source);

    const html = await page.content();
    await context.close();
    await browser.close();
    browser = null;

    // If platform-specific extraction succeeded, use it
    if (platformData && (platformData.title || platformData.price)) {
      return {
        title: platformData.title,
        image: platformData.image,
        priceRaw: platformData.price,
        description: null, // Platform-specific doesn't extract description
        url,
        html,
      };
    }

    // Fallback to JSDOM extraction
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
