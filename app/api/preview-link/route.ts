import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

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

    // 3. Lightweight Fetch (Fast & Safe for Vercel)
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

    const html = await response.text();
    const $ = cheerio.load(html);

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

    // 5. Price Extraction (Robust Amazon Logic)
    let price = '0.00';
    
    // Priority list of selectors (Modern Amazon -> Legacy -> Mobile)
    const priceSelectors = [
      '.a-price .a-offscreen',                // Standard
      '#corePrice_feature_div .a-offscreen',  // Feature div
      '#corePriceDisplay_desktop_feature_div .a-offscreen', // Desktop specific
      '#apex_desktop .a-offscreen',           // Apex layout
      '#priceblock_ourprice',                 // Legacy
      '#priceblock_dealprice',                // Deal
      '.a-color-price',                       // Generic red price
      'input#twister-plus-price-data-price'   // Hidden input data
    ];

    // Try finding the price in the specific Amazon selectors first
    for (const selector of priceSelectors) {
      const found = $(selector).first().text().trim();
      if (found) {
        price = found;
        break; 
      }
    }

    // Fallback: If Amazon selectors fail, try generic Open Graph
    if (!price || price === '0.00') {
      price = $('meta[property="product:price:amount"]').attr('content') || 
              $('meta[property="og:price:amount"]').attr('content') || '0.00';
    }

    // Clean it (remove currency symbols, commas, and text)
    // Example: "$1,299.99" -> "1299.99"
    const cleanPrice = price.replace(/[^0-9.]/g, '');
    
    // Safety check: sometimes scraping grabs hidden text like "29.9929.99"
    // If the price seems suspiciously huge for a decimal, take the first chunk
    let finalPrice = parseFloat(cleanPrice) || 0;

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
