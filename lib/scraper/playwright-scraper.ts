/**
 * Playwright-based scraper for dynamic sites
 * Note: playwright-extra-plugin-stealth is not available, using manual stealth techniques
 */
import { chromium as chromiumExtra } from 'playwright-extra';
import type { Browser } from 'playwright';
import { ScrapeResult } from './static-scraper';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function playwrightScrape(url: string): Promise<ScrapeResult> {
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

    const context = await browser.newContext({
      userAgent: USER_AGENT,
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
      timeout: 20000,
    });

    // Small human-like actions to avoid detection
    await page.waitForTimeout(600 + Math.floor(Math.random() * 600));
    await page.mouse.move(
      100 + Math.floor(Math.random() * 200),
      100 + Math.floor(Math.random() * 200)
    );

    // Wait for network to quiet
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // Ignore timeout, continue anyway
    });

    const html = await page.content();

    // Attempt JSON-LD parse
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
