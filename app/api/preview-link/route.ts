import { NextResponse } from 'next/server';
import { scrapeProduct } from '@/lib/scraper';

// HELPER: Handle CORS
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Handle OPTIONS request (Preflight check from browser)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL required' }, 
        { status: 400, headers: corsHeaders() }
      );
    }

    console.log("🔍 Preview-link: Scraping URL:", url);

    // Use the advanced scraper (Playwright/Stealth) instead of basic axios
    // Dynamic import to avoid webpack analyzing scraper dependencies during build
    const scraperModule = await import('@/lib/scraper');
    const scrapeResult = await scraperModule.scrapeProduct(url) as any;

    if (!scrapeResult || !scrapeResult.ok || !scrapeResult.data) {
      console.error("❌ Preview-link: Scrape failed:", scrapeResult?.error);
      return NextResponse.json(
        { 
          error: scrapeResult?.error || 'Could not connect to the website',
          detail: scrapeResult?.detail 
        },
        { status: 503, headers: corsHeaders() }
      );
    }

    const data = scrapeResult.data;

    // Extract retailer from URL
    const urlObj = new URL(url);
    const retailer = urlObj.hostname.replace('www.', '').split('.')[0];

    // Format price - handle both number and string formats
    let priceValue = null;
    if (data.price) {
      if (typeof data.price === 'string') {
        priceValue = parseFloat(data.price.replace(/[^0-9.]/g, '')) || null;
      } else {
        priceValue = typeof data.price === 'number' ? data.price : null;
      }
    }

    console.log("✅ Preview-link: Scrape successful", {
      title: data.title?.substring(0, 50),
      hasPrice: !!priceValue,
      hasImage: !!data.image
    });

    return NextResponse.json({
      success: true,
      data: {
        url,
        title: (data.title || 'Untitled Item').substring(0, 200),
        image_url: data.image || null,
        price: priceValue,
        retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1),
        description: data.description || ''
      }
    }, { headers: corsHeaders() });

  } catch (error: any) {
    console.error('Scraper Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to scrape link.' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
