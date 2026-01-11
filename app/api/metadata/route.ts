import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { extractDomain, isDynamic } from '@/lib/scraper/utils'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const domain = extractDomain(url)
    let html: string
    let $: ReturnType<typeof cheerio.load>

    // Check if we need Playwright (dynamic sites like Etsy, Amazon)
    // If Railway scraper service is configured, use it for Playwright scraping
    const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL || process.env.RAILWAY_SCRAPER_URL
    const needsPlaywright = isDynamic(domain)

    if (needsPlaywright && scraperServiceUrl) {
      console.log(`🔍 [Metadata] Using Railway scraper for dynamic site: ${domain}`)
      try {
        // Call Railway TypeScript scraper service (supports Playwright)
        const response = await fetch(`${scraperServiceUrl}/api/fetch-product`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(30000), // 30s timeout
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(errorData.error || `Railway scraper returned ${response.status}`)
        }

        const scrapeResult = await response.json()
        
        if (!scrapeResult || !scrapeResult.ok || !scrapeResult.data) {
          const errorMsg = scrapeResult?.error || 'Failed to scrape product'
          console.error(`❌ [Metadata] Railway scraper failed for ${domain}:`, errorMsg)
          throw new Error(errorMsg)
        }

        // Return the scraped data directly
        console.log(`✅ [Metadata] Successfully scraped ${domain} product via Railway`)
        return NextResponse.json({
          title: scrapeResult.data.title || '',
          description: scrapeResult.data.description || '',
          imageUrl: scrapeResult.data.image || '',
          price: scrapeResult.data.priceRaw || null,
        })
      } catch (error: any) {
        console.error(`❌ [Metadata] Error scraping ${domain} via Railway:`, error.message)
        // Fall through to static scraping if Railway fails
        console.log(`⚠️ [Metadata] Falling back to static scraping for ${domain}`)
      }
    }

    // For all other sites (including Amazon), use simple fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    html = await response.text()
    $ = cheerio.load(html)

    // 2. Extract Metadata Helper
    const getMeta = (name: string) => 
      $(`meta[property="${name}"]`).attr('content') || 
      $(`meta[name="${name}"]`).attr('content')

    const title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || ''
    const description = getMeta('og:description') || getMeta('twitter:description') || $('meta[name="description"]').attr('content') || ''
    
    // --- IMPROVED IMAGE EXTRACTION ---
    // We now check 6 different places for an image
    let image = 
      // 1. Standard Open Graph
      getMeta('og:image') || 
      // 2. Twitter Cards
      getMeta('twitter:image') || 
      getMeta('twitter:image:src') ||
      // 3. Schema.org (Common on Google Shopping/Pinterest)
      $('meta[itemprop="image"]').attr('content') ||
      // 4. Secure URL fallback
      $('meta[property="og:image:secure_url"]').attr('content') ||
      // 5. Amazon Specific IDs (Amazon often blocks OG tags but leaves these)
      $('#landingImage').attr('src') ||
      $('#imgBlkFront').attr('src') ||
      // 6. Generic Link fallback
      $('link[rel="image_src"]').attr('href')

    // Fix relative image URLs (e.g., "/images/logo.png" -> "https://site.com/images/logo.png")
    if (image && (image.startsWith('/') || !image.startsWith('http'))) {
      try {
        const urlObj = new URL(url)
        // Handle protocol-relative URLs (//example.com/img.jpg)
        if (image.startsWith('//')) {
          image = `${urlObj.protocol}${image}`
        } else if (image.startsWith('/')) {
          image = `${urlObj.protocol}//${urlObj.host}${image}`
        } else {
          // If it's just a filename "image.jpg", append to base path
          image = new URL(image, url).toString()
        }
      } catch (e) {
        console.error('Error fixing relative image URL:', e)
        // Keep original image string if parsing fails, might still work for some weird edge cases
      }
    }

    // --- PRICE EXTRACTION (Unchanged but validated) ---
    let price = null
    let currency = '$'

    // Try JSON-LD structured data
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

          if (json['@type'] === 'Product' || json['@type'] === 'Offer') {
            checkPrice(json)
          } else if (json['@graph']) {
            const product = json['@graph'].find((item: any) => item['@type'] === 'Product')
            if (product) checkPrice(product)
          }
        } catch (e) { /* skip invalid json */ }
      })
    } catch (e) { /* skip */ }

    // Fallback to meta tags for price
    if (!price) {
      const priceMeta = $('meta[property="product:price:amount"]').attr('content') ||
                        $('meta[name="twitter:data1"]').attr('content')
      if (priceMeta) price = parseFloat(priceMeta)
    }

    const currencyMeta = $('meta[property="product:price:currency"]').attr('content')
    if (currencyMeta) currency = currencyMeta

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
      imageUrl: image || '', // Returns empty string if still nothing found
      price: priceString,
    })

  } catch (error: any) {
    console.error('Metadata fetch error:', error)
    
    // Handle specific error cases
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 408 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch metadata' 
    }, { status: 500 })
  }
}

