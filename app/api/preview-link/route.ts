import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

// User Agent to mimic a real browser (prevents some blocking)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function POST(req: Request) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // 1. Fetch the HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // 2. Extract Metadata Helper
    const getMeta = (name: string) => 
      $(`meta[property="${name}"]`).attr('content') || 
      $(`meta[name="${name}"]`).attr('content')

    let title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || ''
    let description = getMeta('og:description') || getMeta('twitter:description') || $('meta[name="description"]').attr('content') || ''
    
    // 3. Improved Image Extraction (6 different sources)
    let image = 
      // Standard Open Graph
      getMeta('og:image') || 
      // Twitter Cards
      getMeta('twitter:image') || 
      getMeta('twitter:image:src') ||
      // Schema.org (Common on Google Shopping/Pinterest)
      $('meta[itemprop="image"]').attr('content') ||
      // Secure URL fallback
      $('meta[property="og:image:secure_url"]').attr('content') ||
      // Amazon Specific IDs
      $('#landingImage').attr('src') ||
      $('#imgBlkFront').attr('src') ||
      // Generic Link fallback
      $('link[rel="image_src"]').attr('href') || ''

    // Fix relative image URLs
    if (image && (image.startsWith('/') || !image.startsWith('http'))) {
      try {
        const urlObj = new URL(url)
        if (image.startsWith('//')) {
          image = `${urlObj.protocol}${image}`
        } else if (image.startsWith('/')) {
          image = `${urlObj.protocol}//${urlObj.host}${image}`
        } else {
          image = new URL(image, url).toString()
        }
      } catch (e) {
        console.error('Error fixing relative image URL:', e)
      }
    }

    // 4. Price Extraction (JSON-LD + Meta tags)
    let price: number | null = null
    let currency = '$'

    // Try JSON-LD structured data first
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]')
      jsonLdScripts.each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}')
          
          // Helper to check object
          const checkPrice = (obj: any) => {
            if (obj.offers?.price) {
              price = parseFloat(obj.offers.price)
              if (obj.offers.priceCurrency) currency = obj.offers.priceCurrency
            } else if (obj.price) {
              price = parseFloat(obj.price)
            }
          }

          if (json['@type'] === 'Product' || json['@type'] === 'Offer' || json['@type'] === 'http://schema.org/Product') {
            checkPrice(json)
          } else if (json['@graph']) {
            const product = json['@graph'].find((item: any) => 
              item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
            )
            if (product) checkPrice(product)
          }
        } catch (e) {
          // Skip invalid JSON
        }
      })
    } catch (e) {
      // Continue if JSON-LD parsing fails
    }

    // Fallback to meta tags for price
    if (!price) {
      const priceMeta = $('meta[property="product:price:amount"]').attr('content') ||
                        $('meta[property="og:price:amount"]').attr('content') ||
                        $('meta[name="twitter:data1"]').attr('content')
      if (priceMeta) {
        price = parseFloat(priceMeta)
      }
    }

    const currencyMeta = $('meta[property="product:price:currency"]').attr('content') ||
                         $('meta[property="og:price:currency"]').attr('content')
    if (currencyMeta) {
      currency = currencyMeta
    }

    // Extract retailer domain
    const retailer = new URL(url).hostname.replace('www.', '')

    return NextResponse.json({
      success: true,
      data: {
        url,
        title: title.trim(),
        image_url: image || '',
        description: description.trim(),
        price: price,
        price_string: price ? `${currency === 'USD' || currency === '$' ? '$' : currency}${price.toFixed(2)}` : null,
        retailer,
      }
    })

  } catch (error: any) {
    console.error('Preview Link Scraping Error:', error)
    
    // Handle specific error cases
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout - the website took too long to respond' },
        { status: 408 }
      )
    }
    
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Could not connect to the website' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to preview link. The site might be blocking bots.' },
      { status: 500 }
    )
  }
}

