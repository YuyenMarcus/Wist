import { NextResponse } from 'next/server'
import { extractDomain, isDynamic } from '@/lib/scraper/utils'
import { staticScrape } from '@/lib/scraper/static-scraper'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const domain = extractDomain(url)

    // Check if we need Playwright (dynamic sites like Etsy, Amazon)
    const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL
    const needsPlaywright = isDynamic(domain)

    // Try external scraper service first for dynamic sites
    if (needsPlaywright && scraperServiceUrl) {
      console.log(`🔍 [Metadata] Trying Python scraper for dynamic site: ${domain}`)
      try {
        const response = await fetch(`${scraperServiceUrl}/api/scrape/sync`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(30000),
        })

        const scrapeResult = await response.json()
        
        if (response.ok && scrapeResult.success && scrapeResult.result?.title) {
          const result = scrapeResult.result
          console.log(`✅ [Metadata] Python scraper succeeded: ${result.title?.substring(0, 50)}`)
          return NextResponse.json({
            title: result.title || '',
            description: result.description || '',
            imageUrl: result.image || '',
            price: result.priceRaw || (result.price ? `$${result.price}` : null),
          })
        }
        
        console.log(`⚠️ [Metadata] Python scraper incomplete, falling back to static`)
      } catch (error: any) {
        console.log(`⚠️ [Metadata] Python scraper failed (${error.message}), falling back to static`)
      }
    }

    // Use improved static scraper
    console.log(`🔍 [Metadata] Using static scraper for ${domain}`)
    const result = await staticScrape(url)

    // Format price string
    let priceString = null
    if (result.price) {
      priceString = `$${result.price.toFixed(2)}`
    } else if (result.priceRaw) {
      priceString = result.priceRaw.startsWith('$') ? result.priceRaw : `$${result.priceRaw}`
    }

    const hasGoodTitle = result.title && result.title.length > 15 && 
      !result.title.toLowerCase().includes('etsy') && 
      !result.title.toLowerCase().includes('amazon');
    const hasImage = !!result.image;
    
    // Check if we got a poor result for a dynamic site
    const poorResult = !hasGoodTitle && !hasImage;
    const extensionRequired = poorResult && needsPlaywright;
    
    console.log(`✅ [Metadata] Static result: title=${!!result.title}, image=${hasImage}, price=${priceString}, extensionRequired=${extensionRequired}`)

    return NextResponse.json({
      title: result.title?.trim() || '',
      description: result.description?.trim() || '',
      imageUrl: result.image || '',
      price: priceString,
      extensionRequired,
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
