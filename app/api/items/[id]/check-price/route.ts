import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { staticScrape } from '@/lib/scraper/static-scraper'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const itemId = params.id

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: item, error } = await supabase
      .from('items')
      .select('id, url, title, current_price, last_price_check, user_id')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Cooldown between manual checks (per item) — keep short so users can recover from bad scrapes
    const COOLDOWN_MS = 45_000
    if (item.last_price_check) {
      const msSinceLast = Date.now() - new Date(item.last_price_check).getTime()
      if (msSinceLast < COOLDOWN_MS) {
        const waitSec = Math.ceil((COOLDOWN_MS - msSinceLast) / 1000)
        const { data: priceHistory } = await supabase
          .from('price_history')
          .select('price, recorded_at')
          .eq('item_id', itemId)
          .order('recorded_at', { ascending: false })
          .limit(10)

        return NextResponse.json({
          success: true,
          cached: true,
          currentPrice: item.current_price,
          lastChecked: item.last_price_check,
          priceHistory: priceHistory || [],
          message: `Checked recently. Try again in ${waitSec}s.`,
        })
      }
    }

    // Actually scrape the price
    let newPrice: number | null = null
    let scrapeSource = ''

    // Try external scraper services first
    const scraperUrls = [
      process.env.PRICE_TRACKER_URL,
      process.env.MAIN_SCRAPER_URL,
      process.env.NEXT_PUBLIC_SCRAPER_SERVICE_URL,
    ].filter(Boolean) as string[]

    const fwd =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''

    for (const scraperUrl of scraperUrls) {
      if (newPrice) break
      try {
        const response = await fetch(`${scraperUrl}/api/scrape/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(fwd ? { 'X-Forwarded-For': fwd } : {}),
          },
          body: JSON.stringify({ url: item.url }),
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) continue
        const data = await response.json()
        if (data.success && data.result?.price) {
          newPrice = parseFloat(data.result.price)
          scrapeSource = 'external'
        }
      } catch {}
    }

    // Fallback to built-in static scraper
    if (!newPrice) {
      try {
        const result = await staticScrape(item.url)
        if (result?.price && result.price > 0) {
          newPrice = result.price
          scrapeSource = 'static'
        } else if (result?.priceRaw) {
          const parsed = parseFloat(result.priceRaw.replace(/[^0-9.]/g, ''))
          if (parsed > 0) {
            newPrice = parsed
            scrapeSource = 'static-parsed'
          }
        }
      } catch {}
    }

    const oldPrice = item.current_price || 0
    const now = new Date().toISOString()

    if (newPrice && newPrice > 0) {
      const priceChanged = Math.abs(newPrice - oldPrice) > 0.01
      const updateData: Record<string, any> = {
        last_price_check: now,
        updated_at: now,
        price_check_failures: 0,
      }
      if (priceChanged) {
        updateData.current_price = newPrice
      }

      await supabase.from('items').update(updateData).eq('id', itemId)
      await supabase.from('price_history').insert({ item_id: itemId, price: newPrice })

      const { data: priceHistory } = await supabase
        .from('price_history')
        .select('price, recorded_at')
        .eq('item_id', itemId)
        .order('recorded_at', { ascending: false })
        .limit(10)

      let priceChange = null
      let priceChangePercent = null
      if (priceChanged && oldPrice > 0) {
        priceChange = newPrice - oldPrice
        priceChangePercent = ((priceChange / oldPrice) * 100).toFixed(1)
      }

      return NextResponse.json({
        success: true,
        cached: false,
        currentPrice: newPrice,
        previousPrice: oldPrice,
        priceChanged,
        priceChange,
        priceChangePercent,
        lastChecked: now,
        priceHistory: priceHistory || [],
        scrapeSource,
        message: priceChanged
          ? `Price ${newPrice < oldPrice ? 'dropped' : 'increased'}: $${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)}`
          : `Price unchanged at $${newPrice.toFixed(2)}`,
      })
    }

    // Scrape failed — return cached data
    await supabase.from('items').update({
      last_price_check: now,
      price_check_failures: (item as any).price_check_failures ? (item as any).price_check_failures + 1 : 1,
    }).eq('id', itemId)

    const { data: priceHistory } = await supabase
      .from('price_history')
      .select('price, recorded_at')
      .eq('item_id', itemId)
      .order('recorded_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      cached: true,
      currentPrice: item.current_price,
      lastChecked: now,
      priceHistory: priceHistory || [],
      message: 'Could not fetch latest price. Showing last known price.',
    })

  } catch (error) {
    console.error('Error checking price:', error)
    return NextResponse.json(
      { error: 'Failed to check price' },
      { status: 500 }
    )
  }
}
