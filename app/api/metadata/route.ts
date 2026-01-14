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
    const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL
    const needsPlaywright = isDynamic(domain)

    if (needsPlaywright && scraperServiceUrl) {
      console.log(`🔍 [Metadata] Using Python scraper for dynamic site: ${domain}`)
      try {
        // Call Python Flask scraper service (Scrapy + Playwright)
        const railwayUrl = `${scraperServiceUrl}/api/scrape/sync`
        console.log('🚂 Calling scraper:', railwayUrl, 'for URL:', url)

        const response = await fetch(railwayUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(45000), // 45s timeout for slow scrapes
        })

        const text = await response.text()
        console.log('🚂 Scraper raw response:', {
          status: response.status,
          statusText: response.statusText,
          body: text.substring(0, 500)
        })
        
        let scrapeResult
        try {
          scrapeResult = JSON.parse(text)
          console.log('🚂 Scraper parsed response:', scrapeResult)
        } catch (e) {
          console.error('❌ Failed to parse scraper response:', text)
          throw new Error(`Scraper returned invalid JSON: ${text.substring(0, 100)}`)
        }

        // Python scraper returns { success: true, result: {...} }
        if (!response.ok || !scrapeResult.success) {
          const errorMsg = scrapeResult?.error || `Scraper returned ${response.status}`
          throw new Error(errorMsg)
        }
        
        const result = scrapeResult.result
        if (!result || !result.title) {
          throw new Error('Scraper returned no product data')
        }

        // Return the scraped data
        console.log(`✅ [Metadata] Successfully scraped ${domain} via Python scraper`)
        return NextResponse.json({
          title: result.title || '',
          description: result.description || '',
          imageUrl: result.image || '',
          price: result.priceRaw || (result.price ? `$${result.price}` : null),
        })
      } catch (error: any) {
        console.error(`❌ [Metadata] Error scraping ${domain}:`, error.message)
        // Fall through to static scraping
      }
    }

    // For static sites or as fallback, use simple fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }

    html = await response.text()
    $ = cheerio.load(html)

    // Extract Metadata
    const getMeta = (name: string) => 
      $(`meta[property="${name}"]`).attr('content') || 
      $(`meta[name="${name}"]`).attr('content')

    const title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || ''
    const description = getMeta('og:description') || getMeta('twitter:description') || $('meta[name="description"]').attr('content') || ''
    
    // Image extraction
    let image = 
      getMeta('og:image') || 
      getMeta('twitter:image') || 
      getMeta('twitter:image:src') ||
      $('meta[itemprop="image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('#landingImage').attr('src') ||
      $('#imgBlkFront').attr('src') ||
      $('link[rel="image_src"]').attr('href')

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

    // Price extraction
    let price = null
    let currency = '$'

    // Try JSON-LD structured data
    try {
      const jsonLdScripts = $('script[type="application/ld+json"]')
      jsonLdScripts.each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}')
          
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
      imageUrl: image || '',
      price: priceString,
    })

  } catch (error: any) {
    console.error('Metadata fetch error:', error)
    
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 408 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch metadata' 
    }, { status: 500 })
  }
}
