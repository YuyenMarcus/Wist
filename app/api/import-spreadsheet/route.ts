export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { checkItemLimitForApi } from '@/lib/tier-guards'
import * as XLSX from 'xlsx'
import * as cheerio from 'cheerio'

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

// --- Google Sheets URL → CSV / HTML ---

function extractGoogleSheetsId(url: string): string | null {
  if (!url || typeof url !== 'string') return null
  let u = url.trim()
  try {
    u = decodeURIComponent(u)
  } catch {
    // keep original if decode fails
  }
  // docs.google.com/spreadsheets/d/ID (edit, htmlview, pub, etc.)
  let m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  // docs.google.com/spreadsheet/ccc?key=ID (older format)
  m = u.match(/[?&]key=([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  // drive.google.com/file/d/ID (when copied from Drive)
  m = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  // bare ID (44 chars is typical)
  m = u.match(/^([a-zA-Z0-9_-]{40,50})$/)
  if (m) return m[1]
  return null
}

function parseHtmlViewTables(html: string): string[][] {
  const $ = cheerio.load(html)
  const rows: string[][] = []
  $('table tr').each((_, tr) => {
    const row: string[] = []
    $(tr).find('td, th').each((__, cell) => {
      let text = $(cell).text().trim()
      const colspan = parseInt($(cell).attr('colspan') || '1', 10)
      for (let i = 1; i < colspan; i++) row.push('')
      row.push(text)
    })
    if (row.length > 0) rows.push(row)
  })
  return rows
}

async function fetchGoogleSheetAsRows(url: string): Promise<string[][]> {
  const sheetId = extractGoogleSheetsId(url)
  if (!sheetId) throw new Error('Invalid Google Sheets URL')

  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch?.[1] || '0'

  // 1. Try CSV export (works when sheet is shared as "Anyone with link")
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  const csvRes = await fetch(csvUrl, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WistImport/1.0)' },
  })

  const text = await csvRes.text()
  const looksLikeCsv = text.length > 0 && !text.toLowerCase().includes('sign in') && !text.trim().startsWith('<')
  if (csvRes.ok && looksLikeCsv) {
    const wb = XLSX.read(text, { type: 'string' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
  }

  // 2. Fallback: fetch HTML tables (works for "Published to web" / htmlview sheets)
  // gviz/tq returns pure <table> HTML; htmlview/pub return full pages with embedded tables
  const htmlUrls = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:html&tq=&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/pub?output=html&gid=${gid}`,
  ]

  for (const htmlUrl of htmlUrls) {
    const htmlRes = await fetch(htmlUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await htmlRes.text()
    if (htmlRes.ok && html.length > 500 && !html.toLowerCase().includes('sign in')) {
      const rows = parseHtmlViewTables(html)
      if (rows.length >= 2) return rows
    }
  }

  throw new Error(
    'Could not fetch Google Sheet. Try: (1) Share the sheet as "Anyone with the link can view", or (2) Use File → Share → Publish to web.'
  )
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
      const body = await request.json().catch(() => ({}))
      const sheetsUrl = String(
        body?.url ?? body?.link ?? body?.sheetUrl ?? body?.data?.url ?? body?.data?.link ?? ''
      ).trim()
      let sheetId = extractGoogleSheetsId(sheetsUrl)
      if (!sheetId && /^[a-zA-Z0-9_-]{40,}$/.test(sheetsUrl)) {
        sheetId = sheetsUrl // bare ID pasted
      }
      if (!sheetId) {
        return NextResponse.json({
          error: 'Invalid Google Sheets URL',
          hint: 'Paste a full link: docs.google.com/spreadsheets/d/... or drive.google.com/file/d/...',
        }, { status: 400, headers: corsHeaders(origin) })
      }
      const fetchUrl = sheetId && (sheetsUrl.includes('docs.google.com') || sheetsUrl.includes('drive.google.com'))
        ? sheetsUrl
        : `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`
      rows = await fetchGoogleSheetAsRows(fetchUrl)
      sourceLabel = 'Google Sheets'
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      const sheetsUrl = String(params.get('url') ?? params.get('link') ?? '').trim()
      const sheetId = extractGoogleSheetsId(sheetsUrl)
      if (!sheetId) {
        return NextResponse.json({
          error: 'Invalid Google Sheets URL',
          hint: 'Paste a full link: docs.google.com/spreadsheets/d/...',
        }, { status: 400, headers: corsHeaders(origin) })
      }
      rows = await fetchGoogleSheetAsRows(sheetsUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`)
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
      const text = await request.text()
      const looksLikeJson = text.trim().startsWith('{')
      if (looksLikeJson) {
        try {
          const body = JSON.parse(text)
          const sheetsUrl = String(body?.url ?? body?.link ?? body?.sheetUrl ?? '').trim()
          const sheetId = extractGoogleSheetsId(sheetsUrl) || (/^[a-zA-Z0-9_-]{40,}$/.test(sheetsUrl) ? sheetsUrl : null)
          if (sheetId) {
            const fetchUrl = sheetsUrl && (sheetsUrl.includes('docs.google.com') || sheetsUrl.includes('drive.google.com'))
              ? sheetsUrl
              : `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`
            rows = await fetchGoogleSheetAsRows(fetchUrl)
            sourceLabel = 'Google Sheets'
          }
        } catch {
          /* ignore */
        }
      }
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Unsupported content type. Send JSON with { url: "..." }.' }, { status: 400, headers: corsHeaders(origin) })
      }
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
        const limitCheck = await checkItemLimitForApi(user.id, supabaseClient)
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
