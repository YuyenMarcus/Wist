/**
 * Playwright-based scraper for dynamic sites with stealth plugin
 * Uses multiple strategies: stealth plugin, mobile user agents, JSON-LD extraction
 */
import { chromium as chromiumExtra } from 'playwright-extra';
import StealthPlugin from 'playwright-extra-plugin-stealth';
import type { Browser } from 'playwright';
import { ScrapeResult } from './static-scraper';

// Apply stealth plugin to bypass bot detection
chromiumExtra.use(StealthPlugin());

// Multiple user agents for rotation and mobile fallback
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Extract product data from HTML string (for mobile scrape)
 */
async function extractDataFromHtml(html: string, url: string): Promise<ScrapeResult> {
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

  // Extract from meta tags
  if (!title) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (titleMatch) title = titleMatch[1];
  }

  if (!image) {
    const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (imageMatch) image = imageMatch[1];
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
      waitUntil: 'domcontentloaded',
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

    // Extract data from HTML (before closing page/context)
    let title: string | null = null;
    let image: string | null = null;
    let priceRaw: string | null = null;
    let description: string | null = null;

    try {
      const jsonldScripts = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((e) => e.textContent || '').filter(Boolean)
      );

      for (const jsonldText of jsonldScripts) {
        try {
          const j = JSON.parse(jsonldText);

          const processProduct = (item: any) => {
            if (item['@type'] === 'Product') {
              if (item.name && typeof item.name === 'string') {
                title = item.name;
              }
              if (item.image) {
                const img = Array.isArray(item.image) ? item.image[0] : item.image;
                if (typeof img === 'string') image = img;
              }
              if (item.offers?.price) {
                priceRaw = String(item.offers.price);
              } else if (item.aggregateRating?.price) {
                priceRaw = String(item.aggregateRating.price);
              }
              if (item.description && typeof item.description === 'string') {
                description = item.description;
              }
            }
          };

          if (Array.isArray(j)) {
            for (const item of j) {
              processProduct(item);
            }
          } else {
            processProduct(j);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    } catch (e) {
      // Ignore JSON-LD extraction errors
    }

    // Fallback selectors for Amazon
    if (!title) {
      try {
        const titleText = await page
          .locator('#productTitle, h1[data-automation-id="title"]')
          .first()
          .textContent();
        if (titleText) title = titleText;
      } catch (e) {
        // Ignore
      }
    }

    if (!priceRaw) {
      try {
        // Try multiple price selectors
        const price1 = await page
          .locator('.a-price .a-offscreen, [data-automation-id="price"]')
          .first()
          .textContent();
        if (price1) {
          priceRaw = price1;
        } else {
          const price2 = await page
            .locator('[data-testid="price"], .price')
            .first()
            .textContent();
          if (price2) priceRaw = price2;
        }
      } catch (e) {
        // Ignore
      }
    }

    if (!image) {
      try {
        const img1 = await page
          .locator('#landingImage, img[data-automation-id="product-image"]')
          .first()
          .getAttribute('src');
        if (img1) {
          image = img1;
        } else {
          const img2 = await page
            .locator('#landingImage')
            .first()
            .getAttribute('data-old-hires');
          if (img2) image = img2;
        }
      } catch (e) {
        // Ignore
      }
    }

    await context.close();
    await browser.close();
    browser = null;

    // Ensure proper types for return - TypeScript type narrowing workaround
    const desc: string | null = description as string | null;

    return {
      title: title ? title.trim() : null,
      image: image || null,
      priceRaw: priceRaw ? priceRaw.trim() : null,
      description: desc ? desc.trim() : null,
      url,
      html,
    };
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
