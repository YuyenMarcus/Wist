import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { extractDomain, isDynamic } from '../../../lib/scraper/utils';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
    const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL;
    const needsPlaywright = isDynamic(domain);

    if (needsPlaywright && scraperServiceUrl) {
      console.log(`🔍 [Preview] Using Python scraper for dynamic site: ${domain}`);
      try {
        // Call Python Flask scraper service (Scrapy + Playwright)
        const response = await fetch(`${scraperServiceUrl}/api/scrape/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(45000), // 45s timeout
        });

        const scrapeResult = await response.json();
        
        // Python scraper returns { success: true, result: {...} }
        if (!response.ok || !scrapeResult.success) {
          const errorMsg = scrapeResult?.error || `Scraper returned ${response.status}`;
          throw new Error(errorMsg);
        }

        const result = scrapeResult.result;
        if (!result || !result.title) {
          throw new Error('Scraper returned no product data');
        }

        // Return the scraped data in the expected format
        const data = {
          url,
          title: result.title || 'No Title Found',
          image_url: result.image || '',
          price: result.price || 0,
          retailer: domain.split('.')[0],
          description: result.description || ''
        };

        console.log("✅ [Preview] Success via Python scraper:", data.title);
        return NextResponse.json({ success: true, data }, { headers: corsHeaders() });
      } catch (error: any) {
        console.error(`❌ [Preview] Error scraping ${domain}:`, error.message);
        console.log(`⚠️ [Preview] Falling back to static scraping for ${domain}`);
      }
    }

    // For static sites or as fallback, use simple fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    html = await response.text();
    $ = cheerio.load(html);

    // Metadata Extraction
    const title = 
      $('meta[property="og:title"]').attr('content') || 
      $('#productTitle').text().trim() || 
      $('title').text().trim();

    const image = 
      $('meta[property="og:image"]').attr('content') || 
      $('#landingImage').attr('src') || 
      $('img[id="imgBlkFront"]').attr('src') || 
      '';

    // Price Extraction
    let price = '0.00';
    let priceFound = false;
    
    // Strategy 1: JSON-LD structured data
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonData = JSON.parse($(jsonLdScripts[i]).html() || '{}');
          if (jsonData.offers?.price) {
            price = String(jsonData.offers.price);
            priceFound = true;
            break;
          }
          if (jsonData.offers?.['@type'] === 'AggregateOffer' && jsonData.offers.lowPrice) {
            price = String(jsonData.offers.lowPrice);
            priceFound = true;
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}
    
    // Strategy 2: CSS selectors
    if (!priceFound) {
      const priceSelectors = [
        '.a-price .a-offscreen',
        '#corePrice_feature_div .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-offscreen',
        '#apex_desktop .a-offscreen',
        '.a-price-whole',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-color-price',
        '[data-asin-price]'
      ];

      for (const selector of priceSelectors) {
        const found = $(selector).first();
        if (found.length > 0) {
          let foundPrice = found.text().trim();
          if (!foundPrice) {
            foundPrice = found.attr('value') || found.attr('data-asin-price') || '';
          }
          if (foundPrice && foundPrice !== '0.00' && foundPrice !== '$0.00') {
            price = foundPrice;
            priceFound = true;
            break;
          }
        }
      }
    }

    // Strategy 3: Meta tags
    if (!priceFound || price === '0.00') {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') || 
                        $('meta[property="og:price:amount"]').attr('content');
      if (metaPrice) {
        price = metaPrice;
        priceFound = true;
      }
    }

    // Clean price
    const cleanPrice = price.replace(/[^0-9.]/g, '');
    let finalPrice = parseFloat(cleanPrice) || 0;
    
    if (finalPrice > 1000000) {
      const match = cleanPrice.match(/(\d+\.?\d*)/);
      if (match) {
        finalPrice = parseFloat(match[1]) || 0;
      }
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
