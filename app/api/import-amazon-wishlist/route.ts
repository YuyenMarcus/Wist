export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { checkItemLimit } from '@/lib/tier-guards'

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export async function OPTIONS(request: Request) {
  return NextResponse.json({}, { status: 200, headers: corsHeaders(request.headers.get('origin')) })
}

async function getAuthUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookieMap = new Map<string, string>()
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=')
      if (name && valueParts.length > 0) {
        cookieMap.set(name.trim(), valueParts.join('='))
      }
    })
  }

  let user = null
  let supabaseClient: any = null

  if (cookieMap.size > 0) {
    const response = NextResponse.next()
    supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }))
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }: any) => {
              cookieMap.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )
    const { data } = await supabaseClient.auth.getUser()
    if (data?.user) user = data.user
  }

  if (!user) {
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      if (token && token !== 'undefined') {
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } }
        )
        const { data } = await sb.auth.getUser()
        if (data?.user) {
          user = data.user
          supabaseClient = sb
        }
      }
    }
  }

  return { user, supabaseClient }
}

interface AmazonItem {
  title: string
  price: number | null
  imageUrl: string | null
  productUrl: string | null
}

function extractAmazonWishlistId(url: string): string | null {
  // Formats: /hz/wishlist/ls/XXXXX or /registry/wishlist/XXXXX
  const match = url.match(/(?:\/hz\/wishlist\/ls\/|\/registry\/wishlist\/)([A-Z0-9]+)/i)
  return match?.[1] || null
}

function parseAmazonItems(html: string, baseUrl: string): AmazonItem[] {
  const items: AmazonItem[] = []

  // Amazon wishlist items are in elements with id="itemInfo_XXXXX" or data-itemid
  // The HTML structure uses g-items list with individual item blocks

  // Strategy: find all list item blocks
  const itemBlocks = html.split(/id=["']itemMain_/i).slice(1)

  for (const block of itemBlocks) {
    try {
      // Title: inside <a> with id="itemName_XXX"
      const titleMatch = block.match(/id=["']itemName_[^"']*["'][^>]*title=["']([^"']+)["']/i)
        || block.match(/id=["']itemName_[^"']*["'][^>]*>([^<]+)</i)
      const title = titleMatch?.[1]?.trim()

      if (!title) continue

      // Price: look for price spans
      const priceMatch = block.match(/(?:itemUsedAndNewPrice|a-price-whole|price)[^>]*>[\s]*\$?([\d,.]+)/i)
        || block.match(/\$([\d,.]+)/i)
      let price: number | null = null
      if (priceMatch) {
        const cleaned = priceMatch[1].replace(/,/g, '')
        price = parseFloat(cleaned)
        if (isNaN(price)) price = null
      }

      // Image: find img src in the block
      const imgMatch = block.match(/src=["'](https:\/\/[^"']*(?:images-amazon|media-amazon|m\.media-amazon)[^"']+)["']/i)
      const imageUrl = imgMatch?.[1] || null

      // Product URL: find link to product
      const linkMatch = block.match(/href=["'](\/dp\/[A-Z0-9]+[^"']*)["']/i)
        || block.match(/href=["'](\/gp\/product\/[A-Z0-9]+[^"']*)["']/i)
        || block.match(/href=["']([^"']*\/dp\/[A-Z0-9]+[^"']*)["']/i)
      let productUrl: string | null = null
      if (linkMatch) {
        const href = linkMatch[1]
        try {
          productUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString()
        } catch {
          productUrl = `${baseUrl}${href}`
        }
      }

      items.push({ title, price, imageUrl, productUrl })
    } catch {
      // skip malformed blocks
    }
  }

  // Fallback: Try the JSON data that Amazon sometimes embeds
  if (items.length === 0) {
    const jsonMatches = html.matchAll(/"title"\s*:\s*"([^"]+)"[^}]*"price"\s*:\s*\{[^}]*"amount"\s*:\s*([\d.]+)/gi)
    for (const match of jsonMatches) {
      items.push({
        title: match[1],
        price: parseFloat(match[2]) || null,
        imageUrl: null,
        productUrl: null,
      })
    }
  }

  return items
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')

  try {
    const { user, supabaseClient } = await getAuthUser(request)
    if (!user || !supabaseClient) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })
    }

    const body = await request.json()
    const wishlistUrl = body.url as string

    if (!wishlistUrl) {
      return NextResponse.json({ error: 'Amazon wishlist URL is required' }, { status: 400, headers: corsHeaders(origin) })
    }

    const listId = extractAmazonWishlistId(wishlistUrl)
    if (!listId) {
      return NextResponse.json({
        error: 'Invalid Amazon wishlist URL. Expected format: amazon.com/hz/wishlist/ls/XXXXXXXXXX',
      }, { status: 400, headers: corsHeaders(origin) })
    }

    // Determine Amazon domain from URL
    let amazonBase = 'https://www.amazon.com'
    try {
      const parsed = new URL(wishlistUrl)
      amazonBase = `${parsed.protocol}//${parsed.host}`
    } catch {}

    // Fetch the wishlist page (public wishlists are accessible without auth)
    const fetchUrl = `${amazonBase}/hz/wishlist/ls/${listId}?viewType=list`
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      return NextResponse.json({
        error: `Could not fetch Amazon wishlist (HTTP ${res.status}). Make sure the wishlist is set to Public.`,
      }, { status: 400, headers: corsHeaders(origin) })
    }

    const html = await res.text()
    const amazonItems = parseAmazonItems(html, amazonBase)

    if (amazonItems.length === 0) {
      return NextResponse.json({
        error: 'No items found in this wishlist. Make sure the wishlist is Public and contains items. Amazon may also be blocking automated access — try the Excel/CSV import as an alternative.',
        hint: 'You can export your Amazon wishlist to a spreadsheet and import it that way.',
      }, { status: 400, headers: corsHeaders(origin) })
    }

    // Find or create user's wishlist
    let { data: wishlists } = await supabaseClient
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)

    let wishlistId: string
    if (!wishlists || wishlists.length === 0) {
      const { data: newWl, error: wlErr } = await supabaseClient
        .from('wishlists')
        .insert({ user_id: user.id, title: 'My Wishlist', visibility: 'private' })
        .select()
        .single()
      if (wlErr) throw wlErr
      wishlistId = newWl.id
    } else {
      wishlistId = wishlists[0].id
    }

    let imported = 0
    let failed = 0
    const errors: string[] = []

    for (const item of amazonItems) {
      try {
        const limitCheck = await checkItemLimit(supabaseClient, user.id)
        if (!limitCheck.allowed) {
          errors.push(`Item limit reached (${limitCheck.limit}). Upgrade for more.`)
          failed += amazonItems.length - imported - failed
          break
        }

        const { error: insertErr } = await supabaseClient.from('items').insert({
          title: item.title,
          current_price: item.price || 0,
          url: item.productUrl || '',
          image_url: item.imageUrl,
          retailer: 'amazon',
          status: 'queued',
          user_id: user.id,
          wishlist_id: wishlistId,
        })

        if (insertErr) throw insertErr
        imported++
      } catch (err: any) {
        errors.push(`"${item.title.substring(0, 40)}...": ${err.message}`)
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      total: amazonItems.length,
      imported,
      failed,
      errors: errors.slice(0, 10),
      source: 'Amazon Wishlist',
    }, { headers: corsHeaders(origin) })

  } catch (err: any) {
    console.error('❌ Amazon import error:', err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500, headers: corsHeaders(origin) })
  }
}
