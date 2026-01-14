import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const itemId = params.id

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch item with latest price data
    const { data: item, error } = await supabase
      .from('items')
      .select('id, url, title, current_price, last_price_check, user_id')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single()

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Calculate time since last check
    const lastChecked = item.last_price_check ? new Date(item.last_price_check) : null
    const now = new Date()
    const hoursSinceCheck = lastChecked 
      ? Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60))
      : null

    // Get price history for trend
    // Note: price_history table uses 'created_at' column, not 'recorded_at'
    const { data: priceHistory } = await supabase
      .from('price_history')
      .select('price, created_at')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Calculate price trend
    let priceChange = null
    let priceChangePercent = null
    if (priceHistory && priceHistory.length >= 2) {
      const latestPrice = priceHistory[0].price
      const previousPrice = priceHistory[1].price
      priceChange = latestPrice - previousPrice
      priceChangePercent = ((priceChange / previousPrice) * 100).toFixed(1)
    }

    // Determine next check time (based on 24-hour cron)
    const nextCheck = lastChecked 
      ? new Date(lastChecked.getTime() + 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    const hoursUntilNextCheck = Math.max(
      0,
      Math.floor((nextCheck.getTime() - now.getTime()) / (1000 * 60 * 60))
    )

    // Build response message
    let message = ''
    if (!lastChecked) {
      message = 'This item will be checked within 24 hours.'
    } else if (hoursUntilNextCheck > 0) {
      message = `Next automatic check in ${hoursUntilNextCheck} hour${hoursUntilNextCheck !== 1 ? 's' : ''}.`
    } else {
      message = 'Price will be checked shortly.'
    }

    // Return cached data with context
    return NextResponse.json({
      success: true,
      cached: true,
      currentPrice: item.current_price,
      lastChecked: lastChecked?.toISOString(),
      nextCheck: nextCheck.toISOString(),
      hoursUntilNextCheck,
      priceHistory: priceHistory || [],
      priceChange,
      priceChangePercent,
      message,
      dataPoints: priceHistory?.length || 0
    })

  } catch (error) {
    console.error('Error checking price:', error)
    return NextResponse.json(
      { error: 'Failed to check price' },
      { status: 500 }
    )
  }
}

