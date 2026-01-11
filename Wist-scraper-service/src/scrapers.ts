import fetch from 'node-fetch';
import metascraper from 'metascraper';
import msImage from 'metascraper-image';
import msTitle from 'metascraper-title';
import msDesc from 'metascraper-description';
import msUrl from 'metascraper-url';
import { chromium } from 'playwright-extra';

const METASCRAPER = metascraper([msImage(), msTitle(), msDesc(), msUrl()]);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ScrapeResult {
  title: string | null;
  image: string | null;
  priceRaw: string | null;
  description: string | null;
  html: string;
}

// Static metadata scraping (fast)
export async function staticScrape(url: string): Promise<ScrapeResult> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const html = await resp.text();
  const meta = await METASCRAPER({ html, url });

  // Extract price from JSON-LD
  let priceRaw: string | null = null;
  try {
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const obj of arr) {
        if (obj && (obj['@type'] === 'Product' || obj['@type'] === 'Offer')) {
          const price = obj.price || obj.offers?.price || obj.aggregateOffer?.lowPrice;
          if (price) {
            priceRaw = typeof price === 'string' ? price : String(price);
            break;
          }
        }
      }
    }
  } catch (e) {
    // Ignore JSON-LD parse errors
  }

  return {
    title: meta.title || null,
    image: meta.image || null,
    priceRaw,
    description: meta.description || null,
    html,
  };
}

// Domain-specific selectors for known eCommerce sites
const DOMAIN_SELECTORS: Record<string, { price?: string[]; title?: string[]; image?: string[] }> = {
  'amazon.': {
    price: [
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#priceblock_saleprice',
      '.a-price-whole',
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '.a-price-range .a-offscreen',
      '[data-asin-price]',
      '[data-a-color="price"] .a-offscreen',
    ],
    title: ['#productTitle', 'h1.a-size-large', '[data-feature-name="title"]'],
    image: ['#landingImage', '#imgBlkFront', '[data-old-hires]'],
  },
  'bestbuy.': {
    price: ['.priceView-price', '[data-testid="price"]', '.priceView-customer-price'],
    title: ['h1.heading-5', '[data-testid="product-title"]', 'h1'],
    image: ['[data-testid="product-image"] img', '.product-image img'],
  },
  'target.': {
    price: ['[data-test="product-price"]', '.h-padding-r-tiny span', '[data-test="price-current"]'],
    title: ['h1[data-test="product-title"]', 'h1'],
    image: ['[data-test="product-image"] img', '[data-test="carousel-item-image"] img'],
  },
  'walmart.': {
    price: ['[itemprop="price"]', '.price-current', '[data-testid="price"]'],
    title: ['h1.prod-ProductTitle', '[data-testid="product-title"]'],
    image: ['[data-testid="product-image"] img', '[itemprop="image"]'],
  },
  'ebay.': {
    price: ['#prcIsum', '.notranslate', '[itemprop="price"]'],
    title: ['h1#x-item-title-label', '[itemprop="name"]', 'h1'],
    image: ['#icImg', '[itemprop="image"]', '#vi_main_img_fs'],
  },
  'cascadia.': {
    price: ['.price', '[data-price]', '.product-price'],
    title: ['h1.product-title', '.product-name', 'h1'],
    image: ['.product-image img', '[data-image]', 'img.product-image'],
  },
};

function getDomainKey(domain: string | null): string | null {
  if (!domain) return null;
  for (const key in DOMAIN_SELECTORS) {
    if (domain.includes(key)) return key;
  }
  return null;
}

async function waitForSelectors(
  page: any,
  selectors: string[],
  timeout: number = 5000
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout, state: 'visible' });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

// Playwright renderer (stealth + light humanization)
export async function playwrightScrape(url: string): Promise<ScrapeResult> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled', // Hide automation
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Extract domain for selector optimization
    let domain: string | null = null;
    try {
      domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {}

    const domainKey = getDomainKey(domain);
    const selectors = domainKey ? DOMAIN_SELECTORS[domainKey] : null;

    // Etsy-specific: Longer delays and human-like scrolling
    if (domain?.includes('etsy.com')) {
      await page.waitForTimeout(5000); // Increased delay for Etsy
      // Scroll like a human using Playwright's mouse wheel
      try {
        await page.mouse.wheel(0, Math.floor(Math.random() * 500) + 200);
        await page.waitForTimeout(1000);
      } catch (e) {
      // Fallback: use evaluate with explicit typing
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = globalThis as any;
        win.scrollBy(0, Math.floor(Math.random() * 500) + 200);
      });
        await page.waitForTimeout(1000);
      }
    }

    // Wait for known price selectors if available (optimized for known sites)
    if (selectors?.price) {
      await waitForSelectors(page, selectors.price, 10000).catch(() => {
        // Continue if selectors don't appear
      });
    }

    // Small randomized delay to mimic human
    await page.waitForTimeout(700 + Math.floor(Math.random() * 800));

    // Light interaction
    try {
      await page.mouse.move(200 + Math.random() * 200, 200 + Math.random() * 200);
      await page.mouse.wheel(0, 100);
    } catch (e) {
      // Ignore interactive errors
    }

    // Wait for network idle (with slightly increased timeout for heavy pages)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      // Ignore timeout, continue anyway
    });

    const html = await page.content();

    // Try to extract JSON-LD product
    let title: string | null = null;
    let image: string | null = null;
    let priceRaw: string | null = null;
    let description: string | null = null;

    try {
      const jsonldTexts = await page.$$eval(
        'script[type="application/ld+json"]',
        (els) => els.map((e) => e.textContent).filter(Boolean) as string[]
      );

      for (const jsonldText of jsonldTexts) {
        try {
          const parsed = JSON.parse(jsonldText);
          const arr = Array.isArray(parsed) ? parsed : [parsed];

          for (const obj of arr) {
            if (!obj) continue;

            if (obj['@type'] === 'Product' || (obj['@type'] && obj['name'])) {
              title = title || (obj.name && String(obj.name));
              if (obj.image) {
                image = image || (Array.isArray(obj.image) ? obj.image[0] : obj.image);
              }
              if (obj.offers && obj.offers.price) {
                priceRaw = priceRaw || String(obj.offers.price);
              }
              description = description || (obj.description && String(obj.description));
              break;
            }
          }
        } catch (e) {
          // Ignore JSON parse issues
        }
      }
    } catch (e) {
      // Ignore JSON-LD extraction errors
    }

    // Use domain-specific selectors if available (priority)
    if (selectors) {
      // Try title selectors
      if (!title && selectors.title) {
        for (const selector of selectors.title) {
          try {
            const element = await page.$(selector);
            if (element) {
              title = await element.textContent();
              if (title) {
                title = title.trim();
                break;
              }
            }
          } catch {}
        }
      }

      // Try price selectors
      if (!priceRaw && selectors.price) {
        for (const selector of selectors.price) {
          try {
            const element = await page.$(selector);
            if (element) {
              priceRaw = await element.textContent();
              if (!priceRaw) {
                // Try getting attribute if textContent is empty
                priceRaw = await element.getAttribute('content') || 
                          await element.getAttribute('data-price') ||
                          null;
              }
              if (priceRaw) {
                priceRaw = priceRaw.trim();
                break;
              }
            }
          } catch {}
        }
      }

      // Try image selectors
      if (!image && selectors.image) {
        for (const selector of selectors.image) {
          try {
            const element = await page.$(selector);
            if (element) {
              image = await element.getAttribute('src') ||
                     await element.getAttribute('data-src') ||
                     await element.getAttribute('data-old-hires') ||
                     await element.getAttribute('data-hires') ||
                     null;
              if (image) break;
            }
          } catch {}
        }
      }
    }

    // Fallback to generic selectors if domain-specific didn't work
    try {
      if (!title) {
        title = await page.$eval('#productTitle', (el) => el.textContent?.trim() || null);
      }
    } catch {}

    try {
      if (!priceRaw) {
        priceRaw = await page.$eval('.a-price .a-offscreen', (el) => el.textContent?.trim() || null);
      }
    } catch {}

    try {
      if (!image) {
        const imgEl = await page.$('#landingImage');
        if (imgEl) {
          image =
            (await imgEl.getAttribute('src')) ||
            (await imgEl.getAttribute('data-old-hires')) ||
            null;
        }
      }
    } catch {}

    try {
      if (!title) {
        title = await page.title();
      }
    } catch {}

    await browser.close();

    return { title, image, priceRaw, description, html };
  } catch (err) {
    try {
      await browser.close();
    } catch (e) {
      // Ignore cleanup errors
    }
    throw err;
  }
}
