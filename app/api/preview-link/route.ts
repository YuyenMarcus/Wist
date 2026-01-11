import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { extractDomain, isDynamic } from '../../../lib/scraper/utils';

// 1. Mimic a real browser to avoid instant blocking
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 2. Add CORS headers so the extension can read the response
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400, headers: corsHeaders() });
    }

    console.log(`🔍 [Preview] Scraping: ${url}`);

    const domain = extractDomain(url);
    let html: string;
    let $: ReturnType<typeof cheerio.load>;

    // Check if we need Playwright (dynamic sites like Etsy, Amazon)
    // If Railway scraper service is configured, use it for Playwright scraping
    const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL || process.env.RAILWAY_SCRAPER_URL;
    const needsPlaywright = isDynamic(domain);

    if (needsPlaywright && scraperServiceUrl) {
      console.log(`🔍 [Preview] Using Railway scraper for dynamic site: ${domain}`);
      try {
        // Call Railway TypeScript scraper service (supports Playwright)
        const response = await fetch(`${scraperServiceUrl}/api/fetch-product`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Railway scraper returned ${response.status}`);
        }

        const scrapeResult = await response.json();
        
        if (!scrapeResult || !scrapeResult.ok || !scrapeResult.data) {
          const errorMsg = scrapeResult?.error || 'Failed to scrape product';
          console.error(`❌ [Preview] Railway scraper failed for ${domain}:`, errorMsg);
          throw new Error(errorMsg);
        }

        // Return the scraped data in the expected format
        const data = {
          url,
          title: scrapeResult.data.title || 'No Title Found',
          image_url: scrapeResult.data.image || '',
          price: scrapeResult.data.price || 0,
          retailer: domain.split('.')[0],
          description: scrapeResult.data.description || ''
        };

        console.log("✅ [Preview] Success:", data.title);
        return NextResponse.json({ success: true, data }, { headers: corsHeaders() });
      } catch (error: any) {
        console.error(`❌ [Preview] Error scraping ${domain} via Railway:`, error.message);
        // Fall through to static scraping if Railway fails
        console.log(`⚠️ [Preview] Falling back to static scraping for ${domain}`);
      }
    }

    // For all other sites (including Amazon), use simple fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 3600 } // Cache results for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    html = await response.text();
    $ = cheerio.load(html);

    // 4. Robust Metadata Extraction (Works on Amazon & Generic Sites)
    const title = 
      $('meta[property="og:title"]').attr('content') || 
      $('#productTitle').text().trim() || 
      $('title').text().trim();

    const image = 
      $('meta[property="og:image"]').attr('content') || 
      $('#landingImage').attr('src') || 
      $('img[id="imgBlkFront"]').attr('src') || 
      '';

    // 5. COMPREHENSIVE Price Extraction (20+ selectors + JSON-LD)
    let price = '0.00';
    let priceFound = false;
    
    // Strategy 1: Try JSON-LD structured data first (most reliable)
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonData = JSON.parse($(jsonLdScripts[i]).html() || '{}');
          if (jsonData.offers?.price) {
            price = String(jsonData.offers.price);
            priceFound = true;
            console.log("✅ [Preview] Found price in JSON-LD:", price);
            break;
          }
          if (jsonData.offers?.['@type'] === 'AggregateOffer' && jsonData.offers.lowPrice) {
            price = String(jsonData.offers.lowPrice);
            priceFound = true;
            console.log("✅ [Preview] Found price in JSON-LD AggregateOffer:", price);
            break;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    } catch (e) {
      console.warn("⚠️ [Preview] JSON-LD parse error:", e);
    }
    
    // Strategy 2: Comprehensive CSS selectors (if JSON-LD failed)
    if (!priceFound) {
      const priceSelectors = [
        // Modern Amazon layouts
        '.a-price .a-offscreen',
        '#corePrice_feature_div .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
        '#apex_desktop .a-offscreen',
        '.a-price-whole',
        '.a-price .a-price-whole',
        // Legacy selectors
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#priceblock_saleprice',
        '#price',
        // Generic price classes
        '.a-color-price',
        '.a-size-medium.a-color-price',
        '.a-price-range .a-offscreen',
        // Hidden input data
        'input#twister-plus-price-data-price',
        '#priceblock_usedprice',
        '#priceblock_newprice',
        // Mobile/tablet layouts
        '.a-mobile .a-price .a-offscreen',
        '#mobile-price .a-offscreen',
        // Deal/Bundle prices
        '.a-price.a-text-price .a-offscreen',
        '.a-price.a-text-price.a-size-medium .a-offscreen',
        // Price range (take first)
        '.a-price-range .a-offscreen:first-child',
        // Data attributes
        '[data-asin-price]'
      ];

      for (const selector of priceSelectors) {
        const found = $(selector).first();
        if (found.length > 0) {
          // Try text content first
          let foundPrice = found.text().trim();
          // If empty, try value attribute (for inputs)
          if (!foundPrice) {
            foundPrice = found.attr('value') || found.attr('data-asin-price') || '';
          }
          if (foundPrice && foundPrice !== '0.00' && foundPrice !== '$0.00') {
            price = foundPrice;
            priceFound = true;
            console.log(`✅ [Preview] Found price with selector "${selector}":`, price);
            break;
          }
        }
      }
    }

    // Strategy 3: Meta tags fallback
    if (!priceFound || price === '0.00') {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') || 
                        $('meta[property="og:price:amount"]').attr('content');
      if (metaPrice) {
        price = metaPrice;
        priceFound = true;
        console.log("✅ [Preview] Found price in meta tag:", price);
      }
    }

    // Clean and parse price
    // Remove currency symbols, commas, and text, keep numbers and decimal
    const cleanPrice = price.replace(/[^0-9.]/g, '');
    
    // Safety check: if price seems wrong (like "29.9929.99"), take first valid chunk
    let finalPrice = parseFloat(cleanPrice) || 0;
    
    if (finalPrice > 1000000) {
      const match = cleanPrice.match(/(\d+\.?\d*)/);
      if (match) {
        finalPrice = parseFloat(match[1]) || 0;
        console.log("⚠️ [Preview] Fixed suspicious price:", cleanPrice, "->", finalPrice);
      }
    }
    
    if (finalPrice > 0) {
      console.log("✅ [Preview] Final price:", finalPrice);
    } else {
      console.warn("⚠️ [Preview] No valid price found, defaulting to 0");
    }

    const data = {
      url,
      title: title || 'No Title Found',
      image_url: image,
      price: finalPrice,
      retailer: new URL(url).hostname.replace('www.', ''),
      description: $('meta[name="description"]').attr('content') || ''
    };

    console.log("✅ [Preview] Success:", data.title);

    return NextResponse.json({ success: true, data }, { headers: corsHeaders() });

  } catch (error: any) {
    console.error('❌ [Preview] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to parse link' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
