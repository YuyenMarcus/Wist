export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { checkItemLimit } from '@/lib/tier-guards'
import * as XLSX from 'xlsx'

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

// --- Smart Column Detection ---

const NAME_PATTERNS = /^(title|name|item|product|description|product.?name|item.?name)$/i
const PRICE_PATTERNS = /^(price|cost|amount|value|retail|msrp|sale.?price|current.?price|\$)$/i
const URL_PATTERNS = /^(url|link|href|product.?url|product.?link|website|source)$/i
const IMAGE_PATTERNS = /^(image|img|photo|picture|image.?url|thumbnail|image.?link|img.?url)$/i

function looksLikeUrl(val: string): boolean {
  return /^https?:\/\//.test(val) || /^www\./.test(val) || /\.(com|org|net|co|io)\//i.test(val)
}

function looksLikePrice(val: string): boolean {
  return /^\$?\d{1,6}([.,]\d{1,2})?$/.test(val.trim().replace(/[£€¥₹]/g, ''))
}

function looksLikeImageUrl(val: string): boolean {
  return looksLikeUrl(val) && /\.(jpg|jpeg|png|gif|webp|svg|avif)/i.test(val)
}

interface ColumnMapping {
  name: number | null
  price: number | null
  url: number | null
  image: number | null
}

function detectColumns(headers: string[], sampleRows: string[][]): ColumnMapping {
  const mapping: ColumnMapping = { name: null, price: null, url: null, image: null }

  // Phase 1: Match by header names
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim()
    if (!h) continue
    if (NAME_PATTERNS.test(h) && mapping.name === null) mapping.name = i
    else if (PRICE_PATTERNS.test(h) && mapping.price === null) mapping.price = i
    else if (URL_PATTERNS.test(h) && mapping.url === null) mapping.url = i
    else if (IMAGE_PATTERNS.test(h) && mapping.image === null) mapping.image = i
  }

  // Phase 2: Detect by content heuristics for unmapped columns
  if (sampleRows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      if (i === mapping.name || i === mapping.price || i === mapping.url || i === mapping.image) continue

      const samples = sampleRows.map(r => (r[i] || '').toString().trim()).filter(Boolean)
      if (samples.length === 0) continue

      const urlCount = samples.filter(looksLikeUrl).length
      const priceCount = samples.filter(looksLikePrice).length
      const imageCount = samples.filter(looksLikeImageUrl).length
      const ratio = samples.length

      if (mapping.image === null && imageCount / ratio > 0.5) {
        mapping.image = i
      } else if (mapping.url === null && urlCount / ratio > 0.5) {
        mapping.url = i
      } else if (mapping.price === null && priceCount / ratio > 0.5) {
        mapping.price = i
      }
    }
  }

  // Phase 3: If still no name column, pick the first text-heavy column that isn't mapped
  if (mapping.name === null) {
    for (let i = 0; i < headers.length; i++) {
      if (i === mapping.price || i === mapping.url || i === mapping.image) continue
      const samples = sampleRows.map(r => (r[i] || '').toString().trim()).filter(Boolean)
      const avgLen = samples.reduce((a, s) => a + s.length, 0) / (samples.length || 1)
      if (avgLen > 3) {
        mapping.name = i
        break
      }
    }
  }

  return mapping
}

function parsePrice(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,(\d{2})$/, '.$1').replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : Math.round(num * 100) / 100
}

// --- Auth helper ---

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

// --- Google Sheets URL → CSV ---

function extractGoogleSheetsId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] || null
}

async function fetchGoogleSheetAsRows(url: string): Promise<string[][]> {
  const sheetId = extractGoogleSheetsId(url)
  if (!sheetId) throw new Error('Invalid Google Sheets URL')

  // Extract gid if present
  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch?.[1] || '0'

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  const res = await fetch(csvUrl, { redirect: 'follow' })
  if (!res.ok) throw new Error('Could not fetch Google Sheet. Make sure it is shared as "Anyone with the link can view".')

  const text = await res.text()
  const wb = XLSX.read(text, { type: 'string' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
}

// --- Main handler ---

export async function POST(request: Request) {
  const origin = request.headers.get('origin')

  try {
    const { user, supabaseClient } = await getAuthUser(request)
    if (!user || !supabaseClient) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })
    }

    const contentType = request.headers.get('content-type') || ''
    let rows: string[][] = []
    let sourceLabel = 'spreadsheet'

    if (contentType.includes('application/json')) {
      // Google Sheets URL
      const body = await request.json()
      const sheetsUrl = body.url as string
      if (!sheetsUrl || !extractGoogleSheetsId(sheetsUrl)) {
        return NextResponse.json({ error: 'Invalid Google Sheets URL' }, { status: 400, headers: corsHeaders(origin) })
      }
      rows = await fetchGoogleSheetAsRows(sheetsUrl)
      sourceLabel = 'Google Sheets'
    } else if (contentType.includes('multipart/form-data')) {
      // File upload (Excel or CSV)
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: corsHeaders(origin) })
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
      sourceLabel = file.name.endsWith('.csv') ? 'CSV' : 'Excel'
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400, headers: corsHeaders(origin) })
    }

    if (rows.length < 2) {
      return NextResponse.json({ error: 'Spreadsheet must have a header row and at least one data row' }, { status: 400, headers: corsHeaders(origin) })
    }

    const headers = rows[0].map(h => String(h))
    const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim()))
    const sampleRows = dataRows.slice(0, 10).map(r => r.map(c => String(c)))
    const mapping = detectColumns(headers, sampleRows)

    if (mapping.name === null && mapping.url === null) {
      return NextResponse.json({
        error: 'Could not detect item names or URLs in your spreadsheet. Make sure you have a column with product names or links.',
        detectedHeaders: headers,
      }, { status: 400, headers: corsHeaders(origin) })
    }

    // Find or create wishlist
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
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i].map(c => String(c).trim())
      const name = mapping.name !== null ? row[mapping.name] : null
      const rawPrice = mapping.price !== null ? row[mapping.price] : null
      const url = mapping.url !== null ? row[mapping.url] : null
      const imageUrl = mapping.image !== null ? row[mapping.image] : null

      if (!name && !url) {
        skipped++
        continue
      }

      try {
        // Check item limit
        const limitCheck = await checkItemLimit(supabaseClient, user.id)
        if (!limitCheck.allowed) {
          errors.push(`Row ${i + 2}: Item limit reached (${limitCheck.limit}). Upgrade for more.`)
          failed += dataRows.length - i - skipped
          break
        }

        const price = rawPrice ? parsePrice(rawPrice) : null
        const hasUrl = url && looksLikeUrl(url)
        const hasImage = imageUrl && looksLikeImageUrl(imageUrl)

        const insertData: any = {
          title: name || (url ? `Item from ${sourceLabel}` : `Imported item ${i + 1}`),
          current_price: price || 0,
          url: hasUrl ? (url.startsWith('http') ? url : `https://${url}`) : '',
          image_url: hasImage ? imageUrl : null,
          retailer: hasUrl ? new URL(url!.startsWith('http') ? url! : `https://${url!}`).hostname.replace('www.', '').split('.')[0] : 'Import',
          status: 'queued',
          user_id: user.id,
          wishlist_id: wishlistId,
        }

        const { error: insertErr } = await supabaseClient.from('items').insert(insertData)
        if (insertErr) throw insertErr

        imported++
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`)
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      total: dataRows.length,
      imported,
      failed,
      skipped,
      errors: errors.slice(0, 10),
      mapping: {
        name: mapping.name !== null ? headers[mapping.name] : null,
        price: mapping.price !== null ? headers[mapping.price] : null,
        url: mapping.url !== null ? headers[mapping.url] : null,
        image: mapping.image !== null ? headers[mapping.image] : null,
      },
      source: sourceLabel,
    }, { headers: corsHeaders(origin) })

  } catch (err: any) {
    console.error('❌ Import error:', err)
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500, headers: corsHeaders(origin) })
  }
}
