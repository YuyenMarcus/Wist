import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    // 1. Fetch the HTML
    // We add a User-Agent so sites don't block us thinking we are a bot
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()

    // 2. Parse HTML with Cheerio
    const $ = cheerio.load(html)

    // 3. Extract Metadata (Open Graph > Twitter > Standard Meta)
    const getMeta = (name: string) => 
      $(`meta[property="${name}"]`).attr('content') || 
      $(`meta[name="${name}"]`).attr('content')

    const title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || ''
    const description = getMeta('og:description') || getMeta('twitter:description') || $('meta[name="description"]').attr('content') || ''
    
    // Images often need a fallback
    let image = getMeta('og:image') || getMeta('twitter:image') || $('meta[property="og:image:secure_url"]').attr('content')
    
    // Fix relative image URLs
    if (image && image.startsWith('/')) {
      try {
        const urlObj = new URL(url)
        image = `${urlObj.protocol}//${urlObj.host}${image}`
      } catch (e) {
        // If URL parsing fails, skip image
        image = ''
      }
    }

    // Fix protocol-relative URLs
    if (image && image.startsWith('//')) {
      try {
        const urlObj = new URL(url)
        image = `${urlObj.protocol}${image}`
      } catch (e) {
        image = ''
      }
    }

    // Attempt to find Price (Tricky, but we can try common schema tags)
    // Many e-commerce sites use Schema.org product data
    let price = null
    let currency = '$'

    // Try JSON-LD structured data first (most reliable)
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]')
      jsonLdScripts.each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}')
          if (json['@type'] === 'Product' || json['@type'] === 'Offer') {
            if (json.offers && json.offers.price) {
              price = parseFloat(json.offers.price)
              if (json.offers.priceCurrency) {
                currency = json.offers.priceCurrency
              }
            } else if (json.price) {
              price = parseFloat(json.price)
            }
          }
          if (json['@graph']) {
            // Handle @graph structure
            const product = json['@graph'].find((item: any) => item['@type'] === 'Product')
            if (product && product.offers && product.offers.price) {
              price = parseFloat(product.offers.price)
              if (product.offers.priceCurrency) {
                currency = product.offers.priceCurrency
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      })
    } catch (e) {
      // Continue if JSON-LD parsing fails
    }

    // Fallback to meta tags
    if (!price) {
      const priceMeta = $('meta[property="product:price:amount"]').attr('content') ||
                       $('meta[name="twitter:data1"]').attr('content')
      if (priceMeta) {
        price = parseFloat(priceMeta)
      }
    }

    const currencyMeta = $('meta[property="product:price:currency"]').attr('content')
    if (currencyMeta) {
      currency = currencyMeta
    }

    // Format price string
    let priceString = null
    if (price !== null && !isNaN(price)) {
      priceString = currency === 'USD' || currency === '$' 
        ? `$${price.toFixed(2)}` 
        : `${currency}${price.toFixed(2)}`
    }

    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      imageUrl: image || '',
      price: priceString,
    })

  } catch (error: any) {
    console.error('Metadata fetch error:', error)
    
    // Provide helpful error message
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return NextResponse.json({ error: 'Request timeout - the website took too long to respond' }, { status: 408 })
    }
    
    if (error.message?.includes('Failed to fetch') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json({ error: 'Could not connect to the website' }, { status: 503 })
    }

    return NextResponse.json({ 
      error: error.message || 'Failed to fetch metadata' 
    }, { status: 500 })
  }
}

