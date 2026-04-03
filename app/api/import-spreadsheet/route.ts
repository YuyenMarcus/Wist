export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { checkItemLimitForApi } from '@/lib/tier-guards'
import * as XLSX from 'xlsx'
import * as cheerio from 'cheerio'
import { cleanPrice as cleanPriceValue } from '@/lib/scraper/utils'

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

/** Max data rows processed per import (tier limits may still apply per row). */
const SPREADSHEET_IMPORT_MAX_ROWS = 150

// --- Smart Column Detection ---

const NAME_PATTERNS =
  /^(title|name|item|product|description|product.?name|item.?name|listing)$/i
const PRICE_PATTERNS = /^(price|cost|amount|value|retail|msrp|sale.?price|current.?price|\$)$/i
const URL_PATTERNS =
  /^(url|link|href|product.?url|product.?link|item.?link|buy|store|website|source|web.?address|purchase|product\s*link|link\s*to\s*product|item\s*url|shopping\s*link|listing\s*url|store\s*link)$/i
const IMAGE_PATTERNS =
  /^(image|img|photo|picture|pic|thumbnail|image.?url|image.?link|img.?url|cover)$/i

interface ImportCell {
  text: string
  link?: string
  image?: string
}

const emptyCell: ImportCell = { text: '' }

function unwrapGoogleRedirectUrl(u: string): string {
  if (!u.includes('google.com/url') && !u.includes('googleusercontent.com/url')) return u
  try {
    const url = new URL(u, 'https://www.google.com')
    const q = url.searchParams.get('q') || url.searchParams.get('url')
    if (q && /^https?:\/\//i.test(q)) return decodeURIComponent(q)
  } catch {
    /* ignore */
  }
  return u
}

/** Plain CSV / Excel cell: also parses =HYPERLINK(...) and =IMAGE(...) from Google Sheets exports. */
function parseImportCellFromRawString(raw: unknown): ImportCell {
  const s = String(raw ?? '').trim()
  if (!s) return { text: '' }

  // Comma or semicolon (locale) between HYPERLINK args
  let m = s.match(/^=HYPERLINK\s*\(\s*"([^"]+)"\s*[,;]\s*"([^"]*)"\s*\)/i)
  if (m) return { text: (m[2] || '').trim(), link: unwrapGoogleRedirectUrl(m[1].trim()) }
  m = s.match(/^=HYPERLINK\s*\(\s*'([^']+)'\s*[,;]\s*'([^']*)'\s*\)/i)
  if (m) return { text: (m[2] || '').trim(), link: unwrapGoogleRedirectUrl(m[1].trim()) }
  m = s.match(/^=HYPERLINK\s*\(\s*"([^"]+)"\s*\)/i)
  if (m) return { text: m[1].trim(), link: unwrapGoogleRedirectUrl(m[1].trim()) }
  m = s.match(/^=HYPERLINK\s*\(\s*'([^']+)'\s*\)/i)
  if (m) return { text: m[1].trim(), link: unwrapGoogleRedirectUrl(m[1].trim()) }

  m = s.match(/^=IMAGE\s*\(\s*"([^"]+)"/i)
  if (m) return { text: '', image: m[1].trim() }
  m = s.match(/^=IMAGE\s*\(\s*'([^']+)'/i)
  if (m) return { text: '', image: m[1].trim() }

  return { text: s }
}

function cellUrlHint(c: ImportCell): string {
  return (c.link || c.text || '').trim()
}

function cellImageHint(c: ImportCell): string {
  return (c.image || c.link || c.text || '').trim()
}

function looksLikeUrl(val: string): boolean {
  const v = val.trim()
  if (!v) return false
  if (/^mailto:|^tel:/i.test(v)) return false
  if (/^https?:\/\//i.test(v)) return true
  if (/^www\./i.test(v)) return true
  // domain.tld/path without scheme (common when Sheets shows a link label)
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}\/[^\s]*$/i.test(v)) return true
  if (/^[a-z0-9][a-z0-9.-]*\.(com|org|net|co|io|shop|store|eu|uk|us)\//i.test(v)) return true
  // short links (bit.ly, amzn.to, t.co, …)
  if (/^[a-z0-9][a-z0-9.-]*\.(ly|to)\//i.test(v)) return true
  return false
}

/** First http(s) URL inside free text (e.g. "Buy: https://…"). */
function extractHttpUrlsFromString(s: string): string[] {
  const out: string[] = []
  const re = /https?:\/\/[^\s\])>'",\]]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) out.push(m[0])
  return out
}

function looksLikePrice(val: string): boolean {
  return /^\$?\d{1,6}([.,]\d{1,2})?$/.test(val.trim().replace(/[£€¥₹]/g, ''))
}

function looksLikeImageUrl(val: string): boolean {
  if (!looksLikeUrl(val)) return false
  const v = val.toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(val)) return true
  if (
    /images-amazon|media-amazon|ssl-images-amazon|m\.media-amazon|imgix|cloudinary|cdn\.shopify|googleusercontent|ggpht|pinimg|shopifycdn|ksr\.|kickstarter|ebayimg/i.test(
      v
    )
  )
    return true
  return false
}

interface ColumnMapping {
  name: number | null
  price: number | null
  url: number | null
  image: number | null
}

function detectColumns(headers: string[], sampleRows: ImportCell[][]): ColumnMapping {
  const mapping: ColumnMapping = { name: null, price: null, url: null, image: null }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim()
    if (!h) continue
    if (NAME_PATTERNS.test(h) && mapping.name === null) mapping.name = i
    else if (PRICE_PATTERNS.test(h) && mapping.price === null) mapping.price = i
    else if (URL_PATTERNS.test(h) && mapping.url === null) mapping.url = i
    else if (IMAGE_PATTERNS.test(h) && mapping.image === null) mapping.image = i
  }

  if (sampleRows.length > 0) {
    for (let i = 0; i < headers.length; i++) {
      if (i === mapping.name || i === mapping.price || i === mapping.url || i === mapping.image) continue

      const urlSamples = sampleRows.map((r) => cellUrlHint(r[i] || emptyCell)).filter(Boolean)
      const textSamples = sampleRows.map((r) => (r[i] || emptyCell).text.trim()).filter(Boolean)
      const imageSamples = sampleRows.map((r) => cellImageHint(r[i] || emptyCell)).filter(Boolean)
      if (urlSamples.length === 0 && textSamples.length === 0) continue

      const ratio = Math.max(urlSamples.length, textSamples.length, imageSamples.length)
      const urlCount = urlSamples.filter(looksLikeUrl).length
      const priceCount = textSamples.filter(looksLikePrice).length
      const imageCount = imageSamples.filter(looksLikeImageUrl).length

      if (mapping.image === null && imageCount / ratio > 0.5) {
        mapping.image = i
      } else if (mapping.url === null && urlCount / ratio > 0.5) {
        mapping.url = i
      } else if (mapping.price === null && priceCount / ratio > 0.5) {
        mapping.price = i
      }
    }
  }

  if (mapping.name === null) {
    for (let i = 0; i < headers.length; i++) {
      if (i === mapping.price || i === mapping.url || i === mapping.image) continue
      const samples = sampleRows.map((r) => (r[i] || emptyCell).text.trim()).filter(Boolean)
      if (samples.length === 0) continue
      const avgLen = samples.reduce((a, s) => a + s.length, 0) / samples.length
      if (avgLen > 3) {
        mapping.name = i
        break
      }
    }
  }

  return mapping
}

function sheetRowsToImportCells(rows: string[][]): ImportCell[][] {
  return rows.map((r) => r.map((c) => parseImportCellFromRawString(c)))
}

/** Merge grids: `base` keeps display text (usually CSV); `enrich` wins link/image (XLSX / HTML). */
function mergeImportCells(base: ImportCell, enrich: ImportCell): ImportCell {
  const bt = (base.text || '').trim()
  const et = (enrich.text || '').trim()
  return {
    text: bt || et,
    link: enrich.link || base.link,
    image: enrich.image || base.image,
  }
}

function mergeCellGrids(base: ImportCell[][], enrich: ImportCell[][]): ImportCell[][] {
  const maxR = Math.max(base.length, enrich.length)
  const out: ImportCell[][] = []
  for (let r = 0; r < maxR; r++) {
    const br = base[r] || []
    const er = enrich[r] || []
    const maxC = Math.max(br.length, er.length)
    const row: ImportCell[] = []
    for (let c = 0; c < maxC; c++) {
      row.push(mergeImportCells(br[c] || emptyCell, er[c] || emptyCell))
    }
    out.push(row)
  }
  return out
}

function worksheetDimensions(ws: XLSX.WorkSheet): { rows: number; cols: number } {
  const ref = ws['!ref']
  if (!ref) return { rows: 0, cols: 0 }
  const r = XLSX.utils.decode_range(ref)
  return { rows: r.e.r - r.s.r + 1, cols: r.e.c - r.s.c + 1 }
}

/** SheetJS sometimes keeps a separate hyperlink list; merge if cells missed `.l`. */
function applyWorksheetHyperlinkList(rows: ImportCell[][], range: XLSX.Range, ws: XLSX.WorkSheet) {
  const links = (ws as unknown as { '!links'?: [string, { Target?: string }][] })['!links']
  if (!links?.length) return
  for (const [ref, obj] of links) {
    try {
      const addr = XLSX.utils.decode_cell(ref)
      const R = addr.r - range.s.r
      const C = addr.c - range.s.c
      if (R < 0 || C < 0 || R >= rows.length || !rows[R] || C >= rows[R].length) continue
      const t = String(obj?.Target ?? '').trim()
      if (!t || t.startsWith('#')) continue
      let url: string | undefined
      if (/^https?:\/\//i.test(t)) url = unwrapGoogleRedirectUrl(t)
      else if (t.startsWith('//')) url = unwrapGoogleRedirectUrl(`https:${t}`)
      if (!url) continue
      const cell = rows[R][C]
      if (!cell.link) rows[R][C] = { ...cell, link: url }
    } catch {
      /* ignore bad ref */
    }
  }
}

/** Reads hyperlinks (.l.Target), formulas (.f), and display values from an xlsx worksheet. */
function xlsxWorksheetToImportCells(ws: XLSX.WorkSheet): ImportCell[][] {
  const ref = ws['!ref']
  if (!ref) return []
  const range = XLSX.utils.decode_range(ref)
  const rows: ImportCell[][] = []

  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: ImportCell[] = []
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr] as XLSX.CellObject | undefined
      row.push(xlsxCellToImportCell(cell))
    }
    rows.push(row)
  }
  applyWorksheetHyperlinkList(rows, range, ws)
  return rows
}

function xlsxCellToImportCell(cell: XLSX.CellObject | undefined): ImportCell {
  if (!cell) return { text: '' }

  let text = (cell.w != null ? String(cell.w) : cell.v != null ? String(cell.v) : '').trim()

  let link: string | undefined
  const hl = cell.l as { Target?: string } | undefined
  if (hl?.Target) {
    const t = String(hl.Target).trim()
    if (/^https?:\/\//i.test(t)) link = unwrapGoogleRedirectUrl(t)
    else if (t.startsWith('//')) link = unwrapGoogleRedirectUrl(`https:${t}`)
  }

  let image: string | undefined
  const fRaw = typeof cell.f === 'string' ? cell.f.trim() : ''
  const formulaForParse = fRaw ? (fRaw.startsWith('=') ? fRaw : `=${fRaw}`) : ''
  if (formulaForParse) {
    const parsed = parseImportCellFromRawString(formulaForParse)
    if (!link && parsed.link) link = parsed.link
    if (!image && parsed.image) image = parsed.image
    if (!text && parsed.text) text = parsed.text
  }

  const vStr = cell.v != null ? String(cell.v) : ''
  if (vStr.startsWith('=')) {
    const pv = parseImportCellFromRawString(vStr)
    if (!link && pv.link) link = pv.link
    if (!image && pv.image) image = pv.image
    if (!text && pv.text) text = pv.text
  }

  if (!link && !image && text.startsWith('=')) {
    const p = parseImportCellFromRawString(text)
    return { text: (p.text || text).trim(), link: p.link, image: p.image }
  }

  return { text, link, image }
}

function pickWorksheetForGoogleMerge(wb: XLSX.WorkBook, targetRowCount: number, targetColCount: number): XLSX.WorkSheet | null {
  if (wb.SheetNames.length === 0) return null
  let best: { name: string; score: number } | null = null
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const { rows, cols } = worksheetDimensions(ws)
    if (rows === 0) continue
    const score = -Math.abs(rows - targetRowCount) * 10 - Math.abs(cols - targetColCount)
    if (!best || score > best.score) best = { name, score }
  }
  return best ? wb.Sheets[best.name] : wb.Sheets[wb.SheetNames[0]] ?? null
}

function parsePrice(raw: string): number | null {
  if (!raw) return null
  const val = cleanPriceValue(raw)
  return val != null ? Math.round(val * 100) / 100 : null
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

function extractImportCellFromHtml($: cheerio.CheerioAPI, cell: any): ImportCell {
  const $cell = $(cell)
  const text = $cell.text().replace(/\s+/g, ' ').trim()

  let link: string | undefined
  const $links = $cell.find('a[href]')
  for (let i = 0; i < $links.length; i++) {
    let href = $($links[i]).attr('href')?.trim()
    if (!href || /^mailto:|^tel:/i.test(href)) continue
    if (href.startsWith('//')) href = `https:${href}`
    if (/^https?:\/\//i.test(href)) {
      link = unwrapGoogleRedirectUrl(href.split('#')[0])
      break
    }
  }

  let image: string | undefined
  const $imgs = $cell.find('img[src]')
  for (let i = 0; i < $imgs.length; i++) {
    let src = $($imgs[i]).attr('src')?.trim()
    if (!src) continue
    if (src.startsWith('//')) src = `https:${src}`
    if (/^https?:\/\//i.test(src)) {
      image = unwrapGoogleRedirectUrl(src.split('#')[0])
      break
    }
  }

  return { text, link, image }
}

function parseHtmlViewTables(html: string): ImportCell[][] {
  const $ = cheerio.load(html)
  const rows: ImportCell[][] = []
  $('table tr').each((_, tr) => {
    const row: ImportCell[] = []
    $(tr)
      .find('td, th')
      .each((__, cell) => {
        const colspan = parseInt($(cell).attr('colspan') || '1', 10)
        for (let i = 1; i < colspan; i++) row.push({ text: '' })
        row.push(extractImportCellFromHtml($, cell))
      })
    if (row.length > 0) rows.push(row)
  })
  return rows
}

/** When the mapped URL column is empty or only a label, scan the row for hyperlinks / raw URLs / URLs inside text. */
function pickFallbackUrl(row: ImportCell[]): string {
  for (let c = 0; c < row.length; c++) {
    const cell = row[c] || emptyCell
    if (cell.link) {
      const u = unwrapGoogleRedirectUrl(cell.link.trim())
      if (looksLikeUrl(u)) return u
    }
    for (const u of extractHttpUrlsFromString(cell.text)) {
      if (looksLikeUrl(u)) return u
    }
    const t = cell.text.trim()
    if (looksLikeUrl(t)) return t
  }
  return ''
}

function pickFallbackImage(row: ImportCell[]): string {
  for (let c = 0; c < row.length; c++) {
    const cell = row[c] || emptyCell
    const candidates = [cell.image, cell.link, ...extractHttpUrlsFromString(cell.text), cell.text]
    for (const raw of candidates) {
      const v = String(raw || '').trim()
      if (v && looksLikeImageUrl(v)) return v
    }
  }
  return ''
}

async function fetchGoogleSheetAsRows(url: string): Promise<ImportCell[][]> {
  const sheetId = extractGoogleSheetsId(url)
  if (!sheetId) throw new Error('Invalid Google Sheets URL')

  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch?.[1] || '0'

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:html&tq=&gid=${gid}`
  const fetchOpts = { redirect: 'follow' as const, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WistImport/1.0)' } }

  const [csvRes, xlsxRes, gvizRes] = await Promise.all([
    fetch(csvUrl, fetchOpts),
    fetch(xlsxUrl, fetchOpts),
    fetch(gvizUrl, fetchOpts),
  ])

  const [text, xlsxBuf, gvizHtml] = await Promise.all([
    csvRes.text(),
    xlsxRes.ok ? xlsxRes.arrayBuffer() : Promise.resolve(new ArrayBuffer(0)),
    gvizRes.ok ? gvizRes.text() : Promise.resolve(''),
  ])

  let htmlCells: ImportCell[][] | null = null
  if (gvizHtml.length > 500 && !gvizHtml.toLowerCase().includes('sign in')) {
    const parsed = parseHtmlViewTables(gvizHtml)
    if (parsed.length >= 2) htmlCells = parsed
  }
  const looksLikeCsv = text.length > 0 && !text.toLowerCase().includes('sign in') && !text.trim().startsWith('<')

  let csvCells: ImportCell[][] | null = null
  if (csvRes.ok && looksLikeCsv) {
    const wbCsv = XLSX.read(text, { type: 'string' })
    const wsCsv = wbCsv.Sheets[wbCsv.SheetNames[0]]
    const stringRows = XLSX.utils.sheet_to_json(wsCsv, { header: 1, defval: '' }) as string[][]
    csvCells = sheetRowsToImportCells(stringRows)
  }

  let xlsxCells: ImportCell[][] | null = null
  if (xlsxRes.ok && xlsxBuf.byteLength > 200) {
    try {
      const wb = XLSX.read(xlsxBuf, { type: 'array', cellFormula: true })
      const targetRows = csvCells?.length ?? 0
      const targetCols = csvCells?.reduce((m, r) => Math.max(m, r.length), 0) ?? 0
      let ws: XLSX.WorkSheet | null =
        csvCells && targetRows > 0 ? pickWorksheetForGoogleMerge(wb, targetRows, targetCols || 1) : null
      if (!ws && wb.SheetNames[0]) ws = wb.Sheets[wb.SheetNames[0]]
      if (ws) xlsxCells = xlsxWorksheetToImportCells(ws)
    } catch {
      /* ignore corrupt xlsx */
    }
  }

  function mergeHtmlEnrichment(base: ImportCell[][]): ImportCell[][] {
    if (!htmlCells || htmlCells.length < 2 || base.length === 0) return base
    const pair = htmlCells.length >= base.length ? htmlCells.slice(0, base.length) : htmlCells
    return mergeCellGrids(base, pair)
  }

  if (csvCells && xlsxCells) {
    const pairXlsx =
      xlsxCells.length >= csvCells.length ? xlsxCells.slice(0, csvCells.length) : xlsxCells
    return mergeHtmlEnrichment(mergeCellGrids(csvCells, pairXlsx))
  }
  if (csvCells) return mergeHtmlEnrichment(csvCells)
  if (xlsxCells && xlsxCells.length > 0) return mergeHtmlEnrichment(xlsxCells)
  if (htmlCells && htmlCells.length >= 2) return htmlCells

  // Fallback: fetch HTML tables (works for "Published to web" / htmlview sheets)
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
    let rows: ImportCell[][] = []
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
      const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = xlsxWorksheetToImportCells(ws)
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

    const headers = (rows[0] || []).map((h) => (h?.text != null ? String(h.text) : String(h)))
    const rawDataRows = rows
      .slice(1)
      .filter((r) =>
        r.some((cell) => {
          const c = cell || emptyCell
          return Boolean((c.text || c.link || c.image || '').toString().trim())
        })
      )
    const totalRowsInSheet = rawDataRows.length
    const dataRows = rawDataRows.slice(0, SPREADSHEET_IMPORT_MAX_ROWS)
    const truncatedRowCount = Math.max(0, totalRowsInSheet - dataRows.length)
    const sampleRows = dataRows.slice(0, 10)
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
      const row = dataRows[i]
      const nameCell = mapping.name !== null ? row[mapping.name] || emptyCell : emptyCell
      const priceCell = mapping.price !== null ? row[mapping.price] || emptyCell : emptyCell
      const urlCell = mapping.url !== null ? row[mapping.url] || emptyCell : emptyCell
      const imageCell = mapping.image !== null ? row[mapping.image] || emptyCell : emptyCell

      let name = nameCell.text.trim()
      let urlStr = (urlCell.link || urlCell.text || '').trim()
      if (!urlStr && nameCell.link && looksLikeUrl(nameCell.link)) {
        urlStr = nameCell.link.trim()
      }
      if (!urlStr || !looksLikeUrl(urlStr)) {
        const fbUrl = pickFallbackUrl(row)
        if (fbUrl) urlStr = fbUrl
      }

      let imageStr = (imageCell.image || imageCell.link || imageCell.text || '').trim()
      if (!imageStr && imageCell.link && looksLikeImageUrl(imageCell.link)) {
        imageStr = imageCell.link.trim()
      }
      if (
        !imageStr ||
        (!looksLikeImageUrl(imageStr) && !(mapping.image !== null && looksLikeUrl(imageStr)))
      ) {
        const fbImg = pickFallbackImage(row)
        if (fbImg) imageStr = fbImg
      }

      const rawPrice = priceCell.text.trim()

      if (!name && !urlStr) {
        skipped++
        continue
      }

      try {
        const limitCheck = await checkItemLimitForApi(user.id, supabaseClient)
        if (!limitCheck.allowed) {
          errors.push(`Row ${i + 2}: Item limit reached (${limitCheck.limit}). Upgrade for more.`)
          failed += dataRows.length - i - skipped
          break
        }

        const price = rawPrice ? parsePrice(rawPrice) : null
        const hasUrl = Boolean(urlStr && looksLikeUrl(urlStr))
        const normalizedUrl = hasUrl
          ? urlStr.startsWith('http')
            ? urlStr
            : `https://${urlStr}`
          : ''
        const hasImage = Boolean(
          imageStr &&
            (looksLikeImageUrl(imageStr) ||
              (mapping.image !== null && looksLikeUrl(imageStr)))
        )
        const normalizedImage = hasImage
          ? imageStr.startsWith('http')
            ? imageStr
            : `https://${imageStr}`
          : null

        let retailer = 'Import'
        if (hasUrl) {
          try {
            retailer = new URL(normalizedUrl).hostname.replace('www.', '').split('.')[0]
          } catch {
            retailer = 'Import'
          }
        }

        const insertData: Record<string, unknown> = {
          title: name || (urlStr ? `Item from ${sourceLabel}` : `Imported item ${i + 1}`),
          current_price: price || 0,
          url: normalizedUrl,
          image_url: normalizedImage,
          retailer,
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
      totalRowsInSheet,
      maxImportRows: SPREADSHEET_IMPORT_MAX_ROWS,
      truncatedRowCount,
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
