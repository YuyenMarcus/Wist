/**
 * Lightweight static scraper using fetch + cheerio
 * No native dependencies - works with Vercel/Next.js
 * Enhanced with site-specific selectors for Amazon, Target, etc.
 */
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  title: string | null;
  description: string | null;
  image: string | null;
  priceRaw: string | null;
  price?: number | null;
  url: string;
  html?: string;
}

// Site-specific selectors for better extraction
const SITE_SELECTORS: Record<string, {
  title: string[];
  price: string[];
  image: string[];
}> = {
  'amazon.': {
    title: [
      '#productTitle',
      '#title',
      'h1.a-size-large',
      '[data-feature-name="title"] span',
      'meta[property="og:title"]',
    ],
    price: [
      '.a-price .a-offscreen',
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '#apex_desktop .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice', 
      '#priceblock_saleprice',
      '.a-price-whole',
      '[data-asin-price]',
      '.a-color-price',
      '#tp_price_block_total_price_ww .a-offscreen',
      '.priceToPay .a-offscreen',
    ],
    image: [
      '#landingImage',
      '#imgBlkFront',
      '#main-image',
      '[data-old-hires]',
      '#imageBlock img',
      'meta[property="og:image"]',
    ],
  },
  'target.': {
    title: ['h1[data-test="product-title"]', 'h1'],
    price: ['[data-test="product-price"]', 'span[data-test="product-price"]'],
    image: ['[data-test="product-image"] img', 'meta[property="og:image"]'],
  },
  'walmart.': {
    title: ['h1[itemprop="name"]', 'h1'],
    price: ['[itemprop="price"]', 'span[data-testid="price"]'],
    image: ['[data-testid="hero-image"] img', 'meta[property="og:image"]'],
  },
  'bestbuy.': {
    title: ['h1.heading-5', 'h1'],
    price: ['.priceView-customer-price span', '[data-testid="customer-price"]'],
    image: ['img.primary-image', 'meta[property="og:image"]'],
  },
  'etsy.': {
    // Etsy renders most content with JS, so prioritize meta tags
    title: [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'h1[data-buy-box-listing-title]',
      'h1',
    ],
    price: [
      // Etsy includes price in JSON-LD, handled separately
      '[data-buy-box-region="price"] p',
      '.wt-text-title-larger',
    ],
    image: [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      '[data-carousel-paging] img',
    ],
  },
};

function getDomainKey(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const key of Object.keys(SITE_SELECTORS)) {
      if (hostname.includes(key)) return key;
    }
  } catch {}
  return null;
}

export async function staticScrape(url: string): Promise<ScrapeResult> {
  // Use multiple user agents to avoid blocks
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];
  
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  const html = await res.text();
  const $ = cheerio.load(html);

  const domainKey = getDomainKey(url);
  const selectors = domainKey ? SITE_SELECTORS[domainKey] : null;

  let title: string | null = null;
  let image: string | null = null;
  let priceRaw: string | null = null;
  let description: string | null = null;

  // === TITLE EXTRACTION ===
  // Try site-specific selectors first
  if (selectors?.title) {
    for (const selector of selectors.title) {
      if (selector.startsWith('meta')) {
        title = $(selector).attr('content') || null;
      } else {
        title = $(selector).first().text().trim() || null;
      }
      if (title && title.length > 3) break;
    }
  }
  
  // Fallback to generic selectors
  if (!title || title.length < 3) {
    title = 
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').text() ||
      null;
  }

  // === IMAGE EXTRACTION ===
  // Try site-specific selectors first
  if (selectors?.image) {
    for (const selector of selectors.image) {
      if (selector.startsWith('meta')) {
        image = $(selector).attr('content') || null;
      } else {
        const el = $(selector).first();
        image = el.attr('src') || el.attr('data-old-hires') || el.attr('data-src') || null;
      }
      if (image) break;
    }
  }
  
  // Fallback to generic selectors
  if (!image) {
    image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="image"]').attr('content') ||
      $('img[itemprop="image"]').attr('src') ||
      null;
  }

  // === PRICE EXTRACTION ===
  // Try site-specific selectors first
  if (selectors?.price) {
    for (const selector of selectors.price) {
      const el = $(selector).first();
      priceRaw = el.text().trim() || el.attr('content') || el.attr('data-asin-price') || null;
      if (priceRaw && priceRaw.match(/[\d.,]+/)) break;
      priceRaw = null;
    }
  }

  // Try JSON-LD structured data (extracts title, image, AND price)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonLd = JSON.parse($(el).html() || '');
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

      for (const item of items) {
        if (item && (item['@type'] === 'Product' || item['@type'] === 'Offer')) {
          // Extract title from JSON-LD if we don't have one yet
          if ((!title || title.length < 3) && item.name) {
            title = item.name;
          }
          
          // Extract image from JSON-LD if we don't have one yet
          if (!image && item.image) {
            if (Array.isArray(item.image)) {
              image = item.image[0];
            } else if (typeof item.image === 'string') {
              image = item.image;
            } else if (item.image.url) {
              image = item.image.url;
            }
          }
          
          // Extract price from JSON-LD if we don't have one yet
          if (!priceRaw) {
            const price = item.offers?.price || item.offers?.lowPrice || item.price;
            if (price !== undefined && price !== null) {
              priceRaw = String(price);
            }
          }
          
          // Extract description from JSON-LD if we don't have one yet
          if (!description && item.description) {
            description = item.description.substring(0, 500);
          }
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  });

  // Fallback: meta tags for price
  if (!priceRaw) {
    priceRaw = 
      $('meta[property="product:price:amount"]').attr('content') ||
      $('meta[property="og:price:amount"]').attr('content') ||
      null;
  }

  // Last resort: regex search in HTML for price patterns (for Amazon)
  if (!priceRaw && domainKey === 'amazon.') {
    // Multiple regex patterns for Amazon's various price formats
    const amazonPricePatterns = [
      /\"priceAmount\":([0-9.]+)/,
      /\"price\":\"?\$?([0-9.,]+)\"?/,
      /data-asin-price="([0-9.]+)"/,
      /"priceToPay"[^}]*"value":"?\$?([0-9.,]+)"?/,
      /"corePriceDisplay_desktop_feature_div"[^}]*"value":"?\$?([0-9.,]+)"?/,
      /class="a-price"[^>]*>.*?<span[^>]*>.*?\$([0-9.,]+)/s,
      /aria-hidden="true">\$([0-9.,]+)</,
      /"buyingPrice":\s*([0-9.]+)/,
      /"price":\s*"?\$?([0-9.]+)"?/,
      /\$([0-9]+\.[0-9]{2})/,
    ];
    
    for (const pattern of amazonPricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const potentialPrice = parseFloat(match[1].replace(/,/g, ''));
        // Sanity check: price should be reasonable (between $0.01 and $100,000)
        if (potentialPrice >= 0.01 && potentialPrice <= 100000) {
          priceRaw = match[1];
          console.log(`[StaticScraper] Found Amazon price via regex: ${priceRaw}`);
          break;
        }
      }
    }
  }
  
  // Etsy-specific price extraction from HTML
  if (!priceRaw && domainKey === 'etsy.') {
    const etsyPricePatterns = [
      /"price":\s*"?\$?([0-9]+\.?[0-9]*)"?/,
      /"amount":\s*"?([0-9]+\.?[0-9]*)"?/,
      /data-buy-box-listing-price="([0-9.]+)"/,
      /"displayPrice":\s*"?\$?([0-9.,]+)"?/,
      /\$([0-9]+\.[0-9]{2})/,
    ];
    
    for (const pattern of etsyPricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const potentialPrice = parseFloat(match[1].replace(/,/g, ''));
        if (potentialPrice >= 0.01 && potentialPrice <= 100000) {
          priceRaw = match[1];
          console.log(`[StaticScraper] Found Etsy price via regex: ${priceRaw}`);
          break;
        }
      }
    }
  }
  
  // For any site: try to find price in common JavaScript data structures
  if (!priceRaw) {
    const genericPricePatterns = [
      /"price":\s*"?\$?([0-9]+\.?[0-9]*)"?/,
      /"amount":\s*"?([0-9]+\.?[0-9]*)"?/,
      /"salePrice":\s*"?([0-9]+\.?[0-9]*)"?/,
      /"currentPrice":\s*"?([0-9]+\.?[0-9]*)"?/,
    ];
    
    for (const pattern of genericPricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const potentialPrice = parseFloat(match[1]);
        if (potentialPrice >= 0.01 && potentialPrice <= 100000) {
          priceRaw = match[1];
          break;
        }
      }
    }
  }

  // === DESCRIPTION ===
  description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    null;

  // === CLEANUP ===
  title = title?.replace(/\s+/g, ' ').trim() || null;
  
  // Clean Amazon titles (remove " - Amazon.com" suffix)
  if (title && domainKey === 'amazon.') {
    title = title.replace(/\s*[-|]\s*Amazon\.com.*$/i, '').trim();
  }
  
  // Clean Etsy titles (remove " - Etsy" suffix and shop name patterns)
  if (title && domainKey === 'etsy.') {
    title = title.replace(/\s*[-|]\s*Etsy.*$/i, '').trim();
    // Also remove common Etsy title patterns like "Item Name | Etsy Shop Name"
    title = title.replace(/\s*\|\s*[^|]+$/i, '').trim();
  }
  
  // Fix relative image URLs
  if (image && !image.startsWith('http')) {
    try {
      image = new URL(image, url).href;
    } catch {
      image = null;
    }
  }
  
  priceRaw = priceRaw?.trim() || null;
  description = description?.trim() || null;

  // Parse price to number
  let price: number | null = null;
  if (priceRaw) {
    const cleaned = priceRaw.replace(/[^0-9.,]/g, '');
    price = parseFloat(cleaned.replace(',', '')) || null;
  }

  console.log(`[StaticScraper] ${domainKey || 'generic'}: title="${title?.substring(0, 50)}", price=${priceRaw}, hasImage=${!!image}`);

  return {
    title,
    description,
    image,
    priceRaw,
    price,
    url,
    html,
  };
}
