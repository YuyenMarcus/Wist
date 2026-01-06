import * as cheerio from 'cheerio';
import axios from 'axios';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';

export interface ScrapedProduct {
  title: string;
  image_url: string;
  current_price: number | null;
  retailer: string;
}

export async function scrapeProduct(url: string): Promise<ScrapedProduct | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000 // 10s timeout
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // ============================================
    // IMPROVED: Try structured data first (works on all sites)
    // ============================================
    
    // --- 1. TITLE (Multiple strategies) ---
    let title = '';
    
    // Strategy 1: JSON-LD structured data (most reliable)
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const data = JSON.parse($(jsonLdScripts[i]).html() || '{}');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product'))) {
              title = item.name || item.title || '';
              if (title) break;
            }
          }
          if (title) break;
        } catch (e) {
          // Continue to next script
        }
      }
    } catch (e) {
      // Continue to other strategies
    }
    
    // Strategy 2: Open Graph meta tag
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || '';
    }
    
    // Strategy 3: Amazon-specific selector
    if (!title) {
      title = $('#productTitle').text().trim();
    }
    
    // Strategy 4: Generic h1 or title tag
    if (!title) {
      title = $('h1').first().text().trim() || $('title').text().trim();
      // Clean up common prefixes/suffixes
      title = title.replace(/^Amazon\.com:\s*/i, '').replace(/\s*:\s*Amazon\.com$/i, '');
    }

    // --- 2. IMAGE (Multiple strategies) ---
    let image = '';
    
    // Strategy 1: JSON-LD structured data
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const data = JSON.parse($(jsonLdScripts[i]).html() || '{}');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Product' && item.image) {
              if (Array.isArray(item.image)) {
                image = item.image[0] || '';
              } else if (typeof item.image === 'string') {
                image = item.image;
              } else if (item.image.url) {
                image = item.image.url;
              }
              if (image) break;
            }
          }
          if (image) break;
        } catch (e) {
          // Continue to next script
        }
      }
    } catch (e) {
      // Continue to other strategies
    }
    
    // Strategy 2: Open Graph meta tag
    if (!image) {
      image = $('meta[property="og:image"]').attr('content') || '';
    }
    
    // Strategy 3: Amazon-specific selectors
    if (!image) {
      image = $('#landingImage').attr('src') || 
              $('#imgBlkFront').attr('src') || 
              '';
    }
    
    // Strategy 4: Generic product image
    if (!image) {
      image = $('.product-image img').first().attr('src') ||
              $('[itemprop="image"]').first().attr('src') ||
              $('img').first().attr('src') ||
              '';
    }

    // --- 3. PRICE (Multiple strategies) ---
    let price: number | null = null;
    let priceString = '';
    
    // Strategy 1: JSON-LD structured data (most reliable)
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const data = JSON.parse($(jsonLdScripts[i]).html() || '{}');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Product' || item['@type'] === 'Offer' ||
                (Array.isArray(item['@type']) && (item['@type'].includes('Product') || item['@type'].includes('Offer')))) {
              if (item.offers) {
                const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
                if (offer.price) {
                  price = parseFloat(offer.price);
                  priceString = `$${price.toFixed(2)}`;
                  break;
                } else if (offer.lowPrice) {
                  price = parseFloat(offer.lowPrice);
                  priceString = `$${price.toFixed(2)}`;
                  break;
                }
              } else if (item.price) {
                price = parseFloat(item.price);
                priceString = `$${price.toFixed(2)}`;
                break;
              }
            }
          }
          if (price) break;
        } catch (e) {
          // Continue to next script
        }
      }
    } catch (e) {
      // Continue to other strategies
    }
    
    // Strategy 2: Meta tags
    if (!price) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                       $('meta[property="og:price:amount"]').attr('content') ||
                       $('meta[name="price"]').attr('content') ||
                       '';
      if (metaPrice) {
        price = parseFloat(metaPrice);
        priceString = `$${price.toFixed(2)}`;
      }
    }
    
    // Strategy 3: Amazon-specific selectors
    if (!price) {
      const priceSelectors = [
        '.a-price .a-offscreen',       
        '#corePrice_feature_div .a-offscreen',
        '#priceblock_ourprice',        
        '#priceblock_dealprice',        
        '.a-price-whole',
        '#corePrice_feature_div .a-offscreen'
      ];

      for (const selector of priceSelectors) {
        const found = $(selector).first().text().trim();
        if (found) {
          priceString = found;
          break;
        }
      }
    }
    
    // Strategy 4: Generic e-commerce selectors
    if (!price) {
      const genericSelectors = [
        '.price',
        '.product-price',
        '.price-current',
        '[itemprop="price"]',
        '[data-price]'
      ];
      
      for (const selector of genericSelectors) {
        const found = $(selector).first().text().trim() || $(selector).first().attr('content');
        if (found && found.match(/\$?\d+\.?\d*/)) {
          priceString = found;
          break;
        }
      }
    }
    
    // Strategy 5: Regex search in body text (last resort)
    if (!price && !priceString) {
      const bodyText = $('body').text() || '';
      const priceMatch = bodyText.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
      if (priceMatch) {
        priceString = priceMatch[0].trim();
      }
    }

    // Clean and parse price
    if (priceString) {
      const cleanPrice = priceString.replace(/[^0-9.]/g, '');
      price = cleanPrice ? parseFloat(cleanPrice) : null;
    }

    // Extract retailer from URL
    const urlObj = new URL(url);
    const retailer = urlObj.hostname.replace('www.', '').split('.')[0];

    return {
      title: title.substring(0, 200) || 'Untitled Item',
      image_url: image || '',
      current_price: price,
      retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1) // Capitalize first letter
    };
  } catch (error: any) {
    console.error(`Scrape Failed for ${url}:`, error.message);
    return null;
  }
}


