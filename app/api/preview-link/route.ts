import { NextResponse } from 'next/server';
import { extractDomain, isDynamic } from '../../../lib/scraper/utils';
import { staticScrape } from '../../../lib/scraper/static-scraper';

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

    // Check if we need Playwright (dynamic sites like Etsy, Amazon)
    const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL;
    const needsPlaywright = isDynamic(domain);

    // Try external scraper service first for dynamic sites
    if (needsPlaywright && scraperServiceUrl) {
      console.log(`🔍 [Preview] Trying Python scraper for dynamic site: ${domain}`);
      try {
        const response = await fetch(`${scraperServiceUrl}/api/scrape/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        const scrapeResult = await response.json();
        
        if (response.ok && scrapeResult.success && scrapeResult.result?.title) {
          const result = scrapeResult.result;
          const data = {
            url,
            title: result.title || 'No Title Found',
            image_url: result.image || '',
            price: result.price || 0,
            retailer: domain.split('.')[0],
            description: result.description || ''
          };

          console.log("✅ [Preview] Success via Python scraper:", data.title?.substring(0, 50));
          return NextResponse.json({ success: true, data }, { headers: corsHeaders() });
        }
        
        console.log(`⚠️ [Preview] Python scraper returned incomplete data, falling back to static`);
      } catch (error: any) {
        console.log(`⚠️ [Preview] Python scraper failed (${error.message}), falling back to static`);
      }
    }

    // Use improved static scraper (works for all sites including Amazon)
    console.log(`🔍 [Preview] Using static scraper for ${domain}`);
    
    const scrapeResult = await staticScrape(url);
    
    // Parse price from priceRaw
    let finalPrice = 0;
    if (scrapeResult.price) {
      finalPrice = scrapeResult.price;
    } else if (scrapeResult.priceRaw) {
      const cleanPrice = scrapeResult.priceRaw.replace(/[^0-9.]/g, '');
      finalPrice = parseFloat(cleanPrice) || 0;
    }

    const data = {
      url,
      title: scrapeResult.title || 'No Title Found',
      image_url: scrapeResult.image || '',
      price: finalPrice,
      retailer: domain.split('.')[0] || new URL(url).hostname.replace('www.', ''),
      description: scrapeResult.description || '',
      currency: scrapeResult.currency || 'USD',
    };

    // Log result quality
    const hasTitle = !!data.title && data.title !== 'No Title Found';
    const hasImage = !!data.image_url;
    const hasPrice = data.price > 0;
    
    console.log(`✅ [Preview] Static scraper result: title=${hasTitle}, image=${hasImage}, price=${hasPrice} ($${data.price})`);

    // Check if we got a poor result (just domain name as title, no image)
    const poorResult = (!hasTitle || data.title.toLowerCase().includes('etsy') && data.title.length < 20) && !hasImage;
    
    // For dynamic sites with poor static results, indicate extension is needed
    if (poorResult && needsPlaywright) {
      console.log(`⚠️ [Preview] Poor result for dynamic site ${domain}, extension recommended`);
      return NextResponse.json({ 
        success: true, 
        data,
        extensionRequired: true,
        message: 'This site requires the Wist browser extension for full data extraction'
      }, { headers: corsHeaders() });
    }

    // Return success even with partial data
    return NextResponse.json({ success: true, data }, { headers: corsHeaders() });

  } catch (error: any) {
    console.error('❌ [Preview] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to parse link' },
      { status: 500, headers: corsHeaders() }
    );
  }
}
