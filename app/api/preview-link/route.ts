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

    // 5. Price Extraction (Best Effort)
    let price = '0.00';
    
    // Amazon specific selectors
    const amazonPrice = 
      $('.a-price .a-offscreen').first().text() || 
      $('#priceblock_ourprice').text() || 
      $('#priceblock_dealprice').text();

    if (amazonPrice) {
      price = amazonPrice;
    } else {
      // Generic Open Graph Price
      price = $('meta[property="product:price:amount"]').attr('content') || 
              $('meta[property="og:price:amount"]').attr('content') || '0.00';
    }

    // Clean up the price string
    const cleanPrice = price.replace(/[^0-9.]/g, '');

    const data = {
      url,
      title: title || 'No Title Found',
      image_url: image,
      price: parseFloat(cleanPrice) || 0,
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
