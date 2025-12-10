/**
 * Production-safe /api/fetch-product endpoint
 * Always returns valid JSON, handles errors gracefully
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { chromium } from 'playwright';

// Ensure we always return JSON
function sendJson(res: NextApiResponse, status: number, data: any) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.json(data);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return sendJson(res, 405, { 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  // Extract URL from body
  const { url } = req.body || {};

  if (!url || typeof url !== 'string') {
    return sendJson(res, 400, { 
      success: false, 
      error: 'Missing URL parameter' 
    });
  }

  // Validate URL format
  let validUrl: URL;
  try {
    validUrl = new URL(url.trim());
    if (!['http:', 'https:'].includes(validUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return sendJson(res, 400, { 
      success: false, 
      error: 'Invalid URL format' 
    });
  }

  let browser;
  
  try {
    // Launch browser with production-safe args
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Navigate with timeout
    try {
      await page.goto(url.trim(), { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
    } catch (navError) {
      throw new Error(`Navigation failed: ${(navError as Error).message}`);
    }

    // Wait for client-side rendering
    await page.waitForTimeout(2000);

    // Extract product info using multiple selectors
    const product = await page.evaluate(() => {
      // Try multiple title selectors
      const titleSelectors = [
        '#productTitle',
        'h1',
        '.product-title',
        '.title',
        '[data-testid="product-title"]',
        'meta[property="og:title"]',
      ];
      
      let title: string | null = null;
      for (const selector of titleSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            title = el.textContent?.trim() || el.getAttribute('content')?.trim() || null;
            if (title) break;
          }
        } catch {}
      }

      // Try page title as fallback
      if (!title) {
        title = document.title?.trim() || null;
      }

      // Try multiple price selectors
      const priceSelectors = [
        '.a-price .a-offscreen',
        '.price',
        '.product-price',
        '[data-price]',
        '.price-current',
        'meta[property="product:price:amount"]',
      ];
      
      let price: string | null = null;
      for (const selector of priceSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            price = el.textContent?.trim() || el.getAttribute('content')?.trim() || null;
            if (price) break;
          }
        } catch {}
      }

      // Try multiple image selectors
      const imageSelectors = [
        '#landingImage',
        'img#imgTagWrapperId img',
        '.product-image img',
        'meta[property="og:image"]',
        '[data-testid="product-image"] img',
      ];
      
      let image: string | null = null;
      for (const selector of imageSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            image = el.getAttribute('src') || 
                   el.getAttribute('data-src') || 
                   el.getAttribute('content') || 
                   null;
            if (image) break;
          }
        } catch {}
      }

      // Try description selectors
      const descSelectors = [
        '#productDescription',
        '.product-description',
        'meta[property="og:description"]',
        'meta[name="description"]',
      ];
      
      let description: string | null = null;
      for (const selector of descSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            description = el.textContent?.trim() || el.getAttribute('content')?.trim() || null;
            if (description) break;
          }
        } catch {}
      }

      // Check for availability
      const availabilitySelectors = [
        '#availability span',
        '.in-stock',
        '.availability',
        '[data-testid="availability"]',
      ];
      
      let availability: string | null = null;
      for (const selector of availabilitySelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            availability = el.textContent?.trim() || null;
            if (availability) break;
          }
        } catch {}
      }

      // Check for blocking indicators
      const bodyText = document.body?.textContent || '';
      const isBlocked = 
        bodyText.includes('automated access') ||
        bodyText.includes('CAPTCHA') ||
        bodyText.includes('Access Denied') ||
        bodyText.includes('bot detection') ||
        document.querySelector('[data-captcha]') !== null;

      return { 
        title, 
        price, 
        image, 
        description, 
        availability,
        blocked: isBlocked 
      };
    });

    // Validate we got some product data
    if (!product.title && !product.price && !product.image) {
      throw new Error('Could not find product info. Site may be blocking automated access or unsupported format.');
    }

    // Check if blocked
    if (product.blocked) {
      return sendJson(res, 403, {
        success: false,
        error: 'Site is blocking automated access. Please try again later or add manually.',
        data: {
          title: product.title || 'Unknown',
          price: product.price,
          image: product.image,
          description: product.description,
        }
      });
    }

    // Extract domain
    const domain = validUrl.hostname.replace(/^www\./, '');

    // Return normalized response
    return sendJson(res, 200, {
      success: true,
      title: product.title || 'Unknown Product',
      price: product.price,
      priceRaw: product.price,
      image: product.image || null,
      description: product.description || null,
      domain,
      url: url.trim(),
      availability: product.availability,
    });

  } catch (err: any) {
    console.error('Scrape failed:', err.message);
    
    // Always return JSON, even on error
    return sendJson(res, 500, {
      success: false,
      error: err.message || 'Failed to scrape product. Please try again or add manually.',
    });
  } finally {
    // Always close browser
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}
