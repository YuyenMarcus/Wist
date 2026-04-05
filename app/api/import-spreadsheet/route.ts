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
  /^(title|name|item|product|description|product.?name|item.?name|listing|nombre|producto)$/i
const PRICE_PATTERNS =
  /^(price|cost|amount|value|retail|msrp|sale.?price|current.?price|\$|precio)$/i
const URL_PATTERNS =
  /^(url|link|href|product.?url|product.?link|item.?link|buy|store|website|source|web.?address|purchase|product\s*link|link\s*to\s*product|item\s*url|shopping\s*link|listing\s*url|store\s*link|enlace|enlace\s*producto)$/i
const IMAGE_PATTERNS =
  /^(image|img|photo|picture|pic|thumbnail|image.?url|image.?link|img.?url|cover|imagen|foto)$/i

interface ImportCell {
  text: string
  link?: string
  image?: string
}

const emptyCell: ImportCell = { text: '' }

/** Excel column letters → 0-based index (A → 0, Z → 25, AA → 26). */
function colLettersToIndex(letters: string): number {
  let n = 0
  const L = letters.toUpperCase()
  for (let i = 0; i < L.length; i++) {
    const code = L.charCodeAt(i)
    if (code < 65 || code > 90) return -1
    n = n * 26 + (code - 64)
  }
  return n - 1
}

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
  const s = String(raw ?? '').trim().replace(/\r\n/g, '').replace(/\n/g, '')
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

  // HYPERLINK with cell ref as first arg — resolved later via resolveImportGridHyperlinkRefs / XLSX pass
  m = s.match(/^=HYPERLINK\s*\(\s*\$?([A-Za-z]{1,3})\$?(\d+)/i)
  if (m) {
    const labelM = s.match(/[,;]\s*"([^"]*)"\s*\)\s*$/i)
    const labelQ = s.match(/[,;]\s*'([^']*)'\s*\)\s*$/i)
    const display = (labelM?.[1] ?? labelQ?.[1] ?? '').trim()
    return { text: display || s, link: undefined }
  }

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
  if (v.startsWith('//') && /[^/]/.test(v.slice(2))) return true
  if (/^https?:\/\//i.test(v)) return true
  if (/^www\./i.test(v)) return true
  // domain.tld/path without scheme (common when Sheets shows a link label)
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}\/[^\s]*$/i.test(v)) return true
  if (/^[a-z0-9][a-z0-9.-]*\.(com|org|net|co|io|shop|store|eu|uk|us)\//i.test(v)) return true
  // short links (bit.ly, amzn.to, t.co, a.co, …)
  if (/^[a-z0-9][a-z0-9.-]*\.(ly|to|so|gl|co)\//i.test(v)) return true
  // bare ecommerce-style hosts (international TLDs common in Sheets)
  if (
    /^[a-z0-9][a-z0-9.-]*\.(com|org|net|co|io|shop|store|eu|uk|us|ca|de|fr|it|es|nl|be|ch|au|jp|se|no|dk|pl|cz|at|nz|ie|in|br|mx|tv|me)\/[^\s]*$/i.test(
      v
    )
  )
    return true
  return false
}

/** Trim BOM/zero-width chars, newlines, Excel text-prefix quote; unwrap Google redirect wrappers. */
function sanitizeImportUrlCandidate(raw: string): string {
  let v = String(raw ?? '').trim().replace(/^\uFEFF/, '')
  v = v.replace(/[\u200B-\u200D\uFEFF]/g, '')
  v = v.replace(/[\r\n]+/g, ' ').trim()
  if (v.startsWith("'") && v.length > 1) v = v.slice(1).trim()
  if (v.startsWith('//') && v.length > 2) v = `https:${v}`
  v = unwrapGoogleRedirectUrl(v)
  return v.trim()
}

/** Absolute http(s) URL safe for the extension scraper, or null if unusable. */
function normalizeImportProductUrl(raw: string): string | null {
  let s = sanitizeImportUrlCandidate(raw)
  if (!s) return null
  if (!looksLikeUrl(s)) {
    const hit = gatherUrlCandidatesFromText(s)[0]
    if (hit) s = sanitizeImportUrlCandidate(hit)
    if (!s || !looksLikeUrl(s)) return null
  }
  let withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    try {
      const encoded = encodeURI(withScheme.replace(/\s+/g, '%20'))
      const u = new URL(encoded)
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
    } catch {
      /* ignore */
    }
    const cut = withScheme.split(/[\s"'<>[\]]/)[0]?.replace(/[),.;]+$/, '') ?? ''
    if (/^https?:\/\/.+/i.test(cut)) return cut
    return null
  }
}

/** First http(s) URL inside free text (e.g. "Buy: https://…"). */
function extractHttpUrlsFromString(s: string): string[] {
  const out: string[] = []
  const re = /https?:\/\/[^\s<>"')\]}]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    let u = m[0].replace(/[),.;]+$/g, '')
    out.push(u)
  }
  return out
}

/** https://, http://, and protocol-relative //host/... (common in Sheets/HTML). */
function gatherUrlCandidatesFromText(s: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (u: string) => {
    const t = u.trim().replace(/[),.;]+$/, '')
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  for (const u of extractHttpUrlsFromString(s)) add(u)
  const rel = /(^|[\s"'(\[])\/\/[a-z0-9][a-z0-9.-]*(?:\/[^\s<>"')\]\\]*)?/gi
  let rm: RegExpExecArray | null
  while ((rm = rel.exec(s)) !== null) {
    let u = rm[0].replace(/^[\s"'(\[]+/, '')
    if (u.startsWith('//')) u = `https:${u}`
    add(u)
  }
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
      const hyperlinkColCount = sampleRows.filter((r) => Boolean((r[i] || emptyCell).link)).length
      const urlCount = sampleRows.filter((r) => {
        const cell = r[i] || emptyCell
        if (cell.link) return true
        const hint = cellUrlHint(cell)
        return Boolean(hint && looksLikeUrl(hint))
      }).length
      const priceCount = textSamples.filter(looksLikePrice).length
      const imageCount = imageSamples.filter(looksLikeImageUrl).length

      if (mapping.image === null && imageCount / ratio > 0.5) {
        mapping.image = i
      } else if (mapping.url === null && hyperlinkColCount / ratio > 0.35) {
        mapping.url = i
      } else if (mapping.url === null && urlCount / ratio > 0.5) {
        mapping.url = i
      } else if (mapping.price === null && priceCount / ratio > 0.5) {
        mapping.price = i
      }
    }
  }

  // Prefer the column with the most hyperlinks as URL when multiple heuristics could apply.
  if (sampleRows.length > 0 && headers.length > 0) {
    let bestLinkCol: number | null = null
    let bestLinkScore = 0
    for (let i = 0; i < headers.length; i++) {
      if (i === mapping.image) continue
      const n = sampleRows.filter((r) => Boolean((r[i] || emptyCell).link)).length
      if (n > bestLinkScore) {
        bestLinkScore = n
        bestLinkCol = i
      }
    }
    if (bestLinkCol !== null && bestLinkScore >= Math.max(2, Math.ceil(sampleRows.length * 0.25))) {
      const currentUrlScore =
        mapping.url != null
          ? sampleRows.filter((r) => Boolean((r[mapping.url!] || emptyCell).link)).length
          : 0
      if (mapping.url === null || bestLinkScore > currentUrlScore + 1) {
        mapping.url = bestLinkCol
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

/** OR links/images across CSV, XLSX, HTML, GViz JSON at the same (row,col) so one export can supply the URL another strips. */
function combineSourceCellsForGoogle(atoms: ImportCell[]): ImportCell {
  let link: string | undefined
  let image: string | undefined
  let text = ''
  for (const a of atoms) {
    if (!link && a.link?.trim()) link = unwrapGoogleRedirectUrl(a.link.trim())
    if (!image && a.image?.trim()) image = a.image.trim()
  }
  for (const a of atoms) {
    if (a.text?.trim()) {
      text = a.text.trim()
      break
    }
  }
  return { text, link, image }
}

function mergeAlignedGoogleSources(sources: (ImportCell[][] | null)[]): ImportCell[][] {
  const grids = sources.filter((g): g is ImportCell[][] => g != null && g.length > 0)
  if (grids.length === 0) return []
  const maxR = Math.max(...grids.map((g) => g.length))
  const out: ImportCell[][] = []
  for (let r = 0; r < maxR; r++) {
    const maxC = Math.max(...grids.map((g) => (g[r] || []).length), 0)
    const row: ImportCell[] = []
    for (let c = 0; c < maxC; c++) {
      const atoms = grids.map((g) => g[r]?.[c] || emptyCell)
      row.push(combineSourceCellsForGoogle(atoms))
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
      else if (t.startsWith('/')) {
        try {
          url = unwrapGoogleRedirectUrl(new URL(t, 'https://www.google.com').href)
        } catch {
          continue
        }
      }
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
  resolveXlsxHyperlinkCellRefs(ws, range, rows)
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
    else if (t.startsWith('/')) {
      try {
        link = unwrapGoogleRedirectUrl(new URL(t, 'https://www.google.com').href)
      } catch {
        /* ignore */
      }
    }
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

  if (!link && fRaw) {
    for (const u of gatherUrlCandidatesFromText(fRaw)) {
      if (looksLikeImageUrl(u)) continue
      if (normalizeImportProductUrl(u)) {
        link = u
        break
      }
    }
  }
  if (!link && text) {
    for (const u of gatherUrlCandidatesFromText(text)) {
      if (looksLikeImageUrl(u)) continue
      if (normalizeImportProductUrl(u)) {
        link = u
        break
      }
    }
  }

  return { text, link, image }
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
    else if (href.startsWith('/') && !href.startsWith('//')) {
      try {
        href = new URL(href, 'https://www.google.com').href
      } catch {
        continue
      }
    }
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

/** Pull inner JSON object from GViz JSONP (argument to `setResponse(...)`). */
function stripGvizJsonInner(jsonp: string): string | null {
  const s = jsonp.trim().replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '')
  let base = s.indexOf('google.visualization.Query.setResponse')
  if (base < 0) {
    base = s.indexOf('setResponse')
    if (base < 0) return null
  }
  const openParen = s.indexOf('(', base)
  if (openParen < 0) return null
  const jsonStart = s.indexOf('{', openParen)
  if (jsonStart < 0) return null
  let depth = 0
  let inStr = false
  let q = ''
  let esc = false
  for (let i = jsonStart; i < s.length; i++) {
    const ch = s[i]
    if (esc) {
      esc = false
      continue
    }
    if (inStr) {
      if (ch === '\\') esc = true
      else if (ch === q) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") {
      inStr = true
      q = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const inner = s.slice(jsonStart, i + 1)
        try {
          JSON.parse(inner)
          return inner
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function gvizJsonCellToImportCell(cell: { v?: unknown; f?: string } | null | undefined): ImportCell {
  if (cell == null) return emptyCell
  const fRaw = cell.f
  let text = ''
  let link: string | undefined
  let image: string | undefined

  if (typeof fRaw === 'string' && fRaw.length > 0) {
    if (fRaw.includes('<') && (fRaw.includes('href') || fRaw.includes('src='))) {
      try {
        const $ = cheerio.load(`<td>${fRaw}</td>`)
        const el = $('td').first()[0]
        if (el) {
          const ex = extractImportCellFromHtml($, el)
          text = ex.text
          link = ex.link
          image = ex.image
        }
      } catch {
        text = fRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    } else {
      text = fRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }

  const v = cell.v
  if (v != null && typeof v === 'string') {
    const vt = v.trim()
    if (!text) text = vt
    if (!link && /^https?:\/\//i.test(vt)) link = vt
    else if (!link && looksLikeUrl(vt) && !/\s/.test(vt)) link = /^https?:\/\//i.test(vt) ? vt : `https://${vt}`
    if (!link && /HYPERLINK/i.test(vt)) {
      const p = parseImportCellFromRawString(vt.startsWith('=') ? vt : `=${vt}`)
      if (p.link) link = p.link
      if (p.text && !text) text = p.text
    }
  } else if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    const nested =
      typeof o.stringValue === 'string'
        ? o.stringValue
        : typeof o.v === 'string'
          ? o.v
          : typeof o.formattedValue === 'string'
            ? o.formattedValue
            : null
    if (nested) {
      const vt = nested.trim()
      if (!text) text = vt
      if (!link && /^https?:\/\//i.test(vt)) link = vt
      else if (!link && looksLikeUrl(vt) && !/\s/.test(vt)) link = /^https?:\/\//i.test(vt) ? vt : `https://${vt}`
    }
    if (!link) {
      try {
        for (const u of gatherUrlCandidatesFromText(JSON.stringify(v))) {
          if (looksLikeImageUrl(u)) continue
          if (normalizeImportProductUrl(u)) {
            link = u
            break
          }
        }
      } catch {
        /* ignore */
      }
    }
  } else if (v != null && (typeof v === 'number' || typeof v === 'boolean') && !text) {
    text = String(v)
  }

  if (!link && typeof fRaw === 'string' && fRaw.length > 0) {
    for (const u of gatherUrlCandidatesFromText(fRaw)) {
      if (looksLikeImageUrl(u)) continue
      if (normalizeImportProductUrl(u)) {
        link = u
        break
      }
    }
  }

  if (link) link = unwrapGoogleRedirectUrl(link)
  return { text: text.trim(), link, image }
}

/** GViz `out:json` often keeps real URLs in `v` / `<a href>` in `f` when CSV/HTML drop hyperlinks. */
function parseGvizJsonpToImportCells(jsonp: string): ImportCell[][] | null {
  const inner = stripGvizJsonInner(jsonp)
  if (!inner) return null
  let data: {
    status?: string
    table?: {
      cols?: { label?: string }[]
      rows?: { c?: ({ v?: unknown; f?: string } | null)[] }[]
    }
  }
  try {
    data = JSON.parse(inner)
  } catch {
    return null
  }
  if (data.status === 'error') return null
  if (!data.table?.cols?.length || !data.table.rows?.length) return null

  const cols = data.table.cols
  const colCount = cols.length
  const headerRow: ImportCell[] = cols.map((col) => ({
    text: String(col.label ?? '').trim(),
  }))

  const bodyRows: ImportCell[][] = data.table.rows.map((row) => {
    const cells = row.c ?? []
    const importRow: ImportCell[] = []
    for (let i = 0; i < colCount; i++) {
      importRow.push(gvizJsonCellToImportCell(cells[i] ?? null))
    }
    return importRow
  })

  return [headerRow, ...bodyRows]
}

/** Resolve =HYPERLINK(B2,"label") when the URL lives in another column (common in Sheets). */
function resolveImportGridHyperlinkRefs(rows: ImportCell[][]) {
  if (rows.length < 2) return
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const cell = row[c] || emptyCell
      if (cell.link) continue
      const raw = cell.text.trim()
      if (!/HYPERLINK/i.test(raw)) continue
      const f = raw.startsWith('=') ? raw : `=${raw}`
      if (/HYPERLINK\s*\(\s*["']/i.test(f)) {
        const p = parseImportCellFromRawString(raw.startsWith('=') ? raw : `=${raw}`)
        if (p.link) {
          row[c] = { ...cell, link: unwrapGoogleRedirectUrl(p.link) }
        }
        continue
      }
      const refMatch = f.match(/HYPERLINK\s*\(\s*\$?([A-Za-z]{1,3})\$?(\d+)/i)
      if (!refMatch) continue
      const colIdx = colLettersToIndex(refMatch[1])
      const excelRow1 = parseInt(refMatch[2], 10)
      if (Number.isNaN(excelRow1) || colIdx < 0) continue
      const targetRowIdx = excelRow1 - 1
      if (targetRowIdx < 0 || targetRowIdx >= rows.length) continue
      const tr = rows[targetRowIdx]
      if (!tr || colIdx >= tr.length) continue
      const targetCell = tr[colIdx] || emptyCell
      let cand = (targetCell.link || targetCell.text || '').trim()
      if (!cand) continue
      let nu = normalizeImportProductUrl(cand)
      if (!nu) {
        const ex = extractHttpUrlsFromString(cand)[0]
        if (ex) nu = normalizeImportProductUrl(ex)
      }
      if (nu) row[c] = { ...cell, link: nu }
    }
  }
}

function resolveXlsxHyperlinkCellRefs(ws: XLSX.WorkSheet, range: XLSX.Range, rows: ImportCell[][]) {
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr] as XLSX.CellObject | undefined
      const fRaw = typeof cell?.f === 'string' ? cell.f.trim() : ''
      if (!fRaw || !/HYPERLINK/i.test(fRaw)) continue
      const normF = fRaw.startsWith('=') ? fRaw : `=${fRaw}`

      const localR = R - range.s.r
      const localC = C - range.s.c
      const ic = rows[localR]?.[localC]
      if (!ic || ic.link) continue

      if (/HYPERLINK\s*\(\s*["']/i.test(normF)) {
        const p = parseImportCellFromRawString(normF)
        if (p.link) {
          rows[localR][localC] = {
            ...rows[localR][localC],
            link: unwrapGoogleRedirectUrl(p.link),
          }
        }
        if (rows[localR][localC].link) continue
      }

      const refMatch = normF.match(/HYPERLINK\s*\(\s*\$?([A-Za-z]{1,3})\$?(\d+)/i)
      if (refMatch) {
        const colIdx = colLettersToIndex(refMatch[1])
        const excelRow1 = parseInt(refMatch[2], 10)
        if (!Number.isNaN(excelRow1) && colIdx >= 0) {
          const targetSheetR0 = excelRow1 - 1
          const targetLocalR = targetSheetR0 - range.s.r
          if (targetLocalR >= 0 && targetLocalR < rows.length) {
            const tr = rows[targetLocalR]
            if (tr && colIdx < tr.length) {
              const targetCell = tr[colIdx] || emptyCell
              const cand = (targetCell.link || targetCell.text || '').trim()
              let nu = cand ? normalizeImportProductUrl(cand) : null
              if (!nu && cand) {
                const ex = extractHttpUrlsFromString(cand)[0]
                if (ex) nu = normalizeImportProductUrl(ex)
              }
              if (nu) rows[localR][localC] = { ...rows[localR][localC], link: nu }
            }
          }
        }
      }

      if (!rows[localR][localC].link) {
        for (const u of extractHttpUrlsFromString(normF)) {
          if (looksLikeImageUrl(u)) continue
          if (normalizeImportProductUrl(u)) {
            rows[localR][localC] = { ...rows[localR][localC], link: u }
            break
          }
        }
      }
    }
  }
}

/** Last-resort: any http(s) / www in the row (concat all cells) — skips obvious image CDN URLs first. */
function salvageProductUrlFromRow(row: ImportCell[]): string {
  const chunks: string[] = []
  for (const cell of row) {
    if (!cell) continue
    if (cell.link?.trim()) chunks.push(cell.link.trim())
    if (cell.text?.trim()) chunks.push(cell.text.trim())
    if (cell.image?.trim()) chunks.push(cell.image.trim())
  }
  const blob = chunks.join('\n')
  const candidates: string[] = []
  const seen = new Set<string>()
  for (const u of gatherUrlCandidatesFromText(blob)) {
    if (!seen.has(u)) {
      seen.add(u)
      candidates.push(u)
    }
  }
  for (const m of blob.matchAll(/\bwww\.[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}[^\s<>"')\]\\]*\b/gi)) {
    const w = m[0].replace(/[),.;]+$/g, '')
    const withH = /^https?:\/\//i.test(w) ? w : `https://${w}`
    if (!seen.has(withH)) {
      seen.add(withH)
      candidates.push(withH)
    }
  }
  for (const u of candidates) {
    if (looksLikeImageUrl(u)) continue
    if (normalizeImportProductUrl(u)) return u
  }
  for (const u of candidates) {
    if (normalizeImportProductUrl(u)) return u
  }
  return ''
}

/** When the mapped URL column is empty or only a label, scan the row for hyperlinks / raw URLs / URLs inside text. */
function pickFallbackUrl(row: ImportCell[]): string {
  for (let c = 0; c < row.length; c++) {
    const cell = row[c] || emptyCell
    if (cell.link) {
      const u = unwrapGoogleRedirectUrl(cell.link.trim())
      if (looksLikeUrl(u)) return u
    }
    const tx = cell.text.trim()
    if (/HYPERLINK/i.test(tx)) {
      const p = parseImportCellFromRawString(tx.startsWith('=') ? tx : `=${tx}`)
      if (p.link && looksLikeUrl(p.link)) return p.link
    }
    for (const u of gatherUrlCandidatesFromText(cell.text)) {
      if (looksLikeUrl(u)) return u
    }
    if (looksLikeUrl(tx)) return tx
  }
  const salvaged = salvageProductUrlFromRow(row)
  if (salvaged) return salvaged
  const amazon = tryAmazonDpUrlFromRow(row)
  if (amazon) return amazon
  return ''
}

function pickBestXlsxGridFromWorkbook(wb: XLSX.WorkBook, hintRows: number, hintCols: number): ImportCell[][] | null {
  if (!wb.SheetNames.length) return null
  let best: { rows: ImportCell[][]; score: number } | null = null
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws) continue
    const rows = xlsxWorksheetToImportCells(ws)
    if (rows.length < 2) continue
    let score = 0
    const check = Math.min(rows.length, 60)
    for (let r = 1; r < check; r++) {
      const row = rows[r]
      if (!row) continue
      const u = pickFallbackUrl(row) || salvageProductUrlFromRow(row)
      if (u && normalizeImportProductUrl(u)) {
        score += 4
      } else if (
        row.some((ch) => gatherUrlCandidatesFromText(`${ch?.text || ''} ${ch?.link || ''}`).length > 0)
      ) {
        score += 1
      }
    }
    const dim = worksheetDimensions(ws)
    const dimBonus = hintRows > 0 ? -Math.abs(dim.rows - hintRows) * 3 - Math.abs(dim.cols - hintCols) : 0
    const total = score * 100 + dimBonus
    if (!best || total > best.score) best = { rows, score: total }
  }
  return best?.rows ?? null
}

/** Amazon ASIN (B#########) or amazon host with /dp/ or /gp/product/ in row → product URL. */
function tryAmazonDpUrlFromRow(row: ImportCell[]): string | null {
  const blob = row.map((c) => `${c?.text ?? ''} ${c?.link ?? ''} ${c?.image ?? ''}`).join('\n')
  const full = blob.match(/https?:\/\/(?:www\.)?(amazon\.[a-z.]+)\/(?:[^/\s]*\/)?(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?\s]|$)/i)
  if (full) {
    const u = `https://${full[1]}/dp/${full[2]}`
    const n = normalizeImportProductUrl(u)
    if (n) return n
  }
  const asin = blob.match(/\b(B[0-9A-Z]{9})\b/)
  if (asin) {
    const u = `https://www.amazon.com/dp/${asin[1]}`
    if (normalizeImportProductUrl(u)) return u
  }
  return null
}

interface SheetsApiCellValue {
  formattedValue?: string
  hyperlink?: string
  effectiveValue?: { stringValue?: string; numberValue?: number; boolValue?: boolean }
}

function sheetsApiCellToImportCell(cv: SheetsApiCellValue | undefined): ImportCell {
  if (!cv) return emptyCell
  let text = ''
  if (cv.formattedValue != null) text = String(cv.formattedValue).trim()
  const ev = cv.effectiveValue
  if (!text && ev?.stringValue != null) text = String(ev.stringValue).trim()
  if (!text && ev?.numberValue != null) text = String(ev.numberValue)
  if (!text && ev?.boolValue != null) text = String(ev.boolValue)
  let link: string | undefined
  const h = cv.hyperlink?.trim()
  if (h) link = unwrapGoogleRedirectUrl(h)
  return { text, link }
}

/**
 * Reads true cell hyperlinks (Insert→Link) via Sheets API — often absent from CSV/XLSX/gviz exports.
 * Set GOOGLE_SHEETS_API_KEY (restricted to Sheets API; sheet must be readable — e.g. "Anyone with the link").
 */
async function fetchGoogleSheetGridDataViaApi(spreadsheetId: string, gid: string): Promise<ImportCell[][] | null> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim()
  if (!apiKey) return null

  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId%2Ctitle%2CgridProperties(rowCount%2CcolumnCount)))&key=${encodeURIComponent(apiKey)}`
    const metaRes = await fetch(metaUrl)
    if (!metaRes.ok) {
      console.error('[SheetsAPI] metadata failed', metaRes.status, await metaRes.text())
      return null
    }
    const meta = (await metaRes.json()) as {
      sheets?: {
        properties: {
          sheetId: number
          title: string
          gridProperties?: { rowCount?: number; columnCount?: number }
        }
      }[]
    }
    const sheets = meta.sheets
    if (!sheets?.length) return null

    const gidNum = parseInt(gid, 10)
    const sheet =
      !Number.isNaN(gidNum) ? sheets.find((s) => s.properties.sheetId === gidNum) ?? sheets[0] : sheets[0]

    const title = sheet.properties.title
    const gpr = sheet.properties.gridProperties
    const rowCount = Math.min(Math.max(2, gpr?.rowCount ?? 400), 600)
    const colCount = Math.min(Math.max(8, gpr?.columnCount ?? 40), 100)
    const lastCol = XLSX.utils.encode_col(colCount - 1)
    const safeTitle = `'${title.replace(/'/g, "''")}'`
    const a1Range = `${safeTitle}!A1:${lastCol}${rowCount}`

    const dataUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}` +
      `?includeGridData=true` +
      `&ranges=${encodeURIComponent(a1Range)}` +
      `&fields=sheets(data(rowData(values(formattedValue%2Chyperlink%2CeffectiveValue(stringValue%2CnumberValue%2CboolValue)))))` +
      `&key=${encodeURIComponent(apiKey)}`

    const dataRes = await fetch(dataUrl)
    if (!dataRes.ok) {
      console.error('[SheetsAPI] grid fetch failed', dataRes.status, await dataRes.text())
      return null
    }
    const data = (await dataRes.json()) as {
      sheets?: { data?: { rowData?: { values?: SheetsApiCellValue[] }[] }[] }[]
    }
    const rowData = data.sheets?.[0]?.data?.[0]?.rowData
    if (!rowData?.length) return null

    let maxCols = 0
    const out: ImportCell[][] = []
    for (const rd of rowData) {
      const cells = rd.values ?? []
      maxCols = Math.max(maxCols, cells.length)
      const importRow: ImportCell[] = cells.map((cell) => sheetsApiCellToImportCell(cell))
      out.push(importRow)
    }
    for (const row of out) {
      while (row.length < maxCols) row.push(emptyCell)
    }
    return out.length >= 2 ? out : null
  } catch (err) {
    console.error('[SheetsAPI] exception', err instanceof Error ? err.message : err)
    return null
  }
}

function pickFallbackImage(row: ImportCell[]): string {
  for (let c = 0; c < row.length; c++) {
    const cell = row[c] || emptyCell
    const candidates = [cell.image, cell.link, ...gatherUrlCandidatesFromText(cell.text), cell.text]
    for (const raw of candidates) {
      const v = String(raw || '').trim()
      if (v && looksLikeImageUrl(v)) return v
    }
  }
  return ''
}

type FetchGoogleSheetResult = { rows: ImportCell[][]; sheetsApiGridLoaded: boolean }

async function fetchGoogleSheetAsRows(url: string): Promise<FetchGoogleSheetResult> {
  const sheetId = extractGoogleSheetsId(url)
  if (!sheetId) throw new Error('Invalid Google Sheets URL')

  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  const gid = gidMatch?.[1] || '0'

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:html&tq=&gid=${gid}`
  const gvizJsonUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&tq=&gid=${gid}`
  const googleFetchHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,text/csv,application/vnd.ms-excel,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
  const fetchOpts = { redirect: 'follow' as const, headers: googleFetchHeaders }

  const apiGridPromise = fetchGoogleSheetGridDataViaApi(sheetId, gid)

  const [csvRes, xlsxRes, gvizRes, gvizJsonRes, apiCellsFromKey] = await Promise.all([
    fetch(csvUrl, fetchOpts),
    fetch(xlsxUrl, fetchOpts),
    fetch(gvizUrl, fetchOpts),
    fetch(gvizJsonUrl, fetchOpts),
    apiGridPromise,
  ])

  const [text, xlsxBuf, gvizHtml, gvizJsonText] = await Promise.all([
    csvRes.text(),
    xlsxRes.ok ? xlsxRes.arrayBuffer() : Promise.resolve(new ArrayBuffer(0)),
    gvizRes.ok ? gvizRes.text() : Promise.resolve(''),
    gvizJsonRes.ok ? gvizJsonRes.text() : Promise.resolve(''),
  ])

  let htmlCells: ImportCell[][] | null = null
  if (gvizHtml.length > 500 && !gvizHtml.toLowerCase().includes('sign in')) {
    const parsed = parseHtmlViewTables(gvizHtml)
    if (parsed.length >= 2) htmlCells = parsed
  }

  let gvizJsonCells: ImportCell[][] | null = null
  if (gvizJsonText.length > 200 && !gvizJsonText.toLowerCase().includes('sign in')) {
    gvizJsonCells = parseGvizJsonpToImportCells(gvizJsonText)
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
      xlsxCells = pickBestXlsxGridFromWorkbook(wb, targetRows, targetCols || 1)
    } catch {
      /* ignore corrupt xlsx */
    }
  }

  function finalizeGoogleSheetRows(grid: ImportCell[][]): ImportCell[][] {
    if (grid.length >= 2) resolveImportGridHyperlinkRefs(grid)
    return grid
  }

  const sheetsApiGridLoaded = Boolean(apiCellsFromKey && apiCellsFromKey.length >= 2)

  const mergedCore = mergeAlignedGoogleSources([
    apiCellsFromKey,
    csvCells,
    xlsxCells,
    htmlCells,
    gvizJsonCells,
  ])

  if (mergedCore.length >= 2) {
    return { rows: finalizeGoogleSheetRows(mergedCore), sheetsApiGridLoaded }
  }

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
      if (rows.length >= 2) {
        const out = mergeAlignedGoogleSources([rows, gvizJsonCells])
        return { rows: finalizeGoogleSheetRows(out), sheetsApiGridLoaded }
      }
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
    let clientTier: string | undefined
    let sheetsApiGridLoaded = false

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      if (body?.client_tier != null && String(body.client_tier).trim() !== '') {
        clientTier = String(body.client_tier).trim()
      }
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
      const sheetResult = await fetchGoogleSheetAsRows(fetchUrl)
      rows = sheetResult.rows
      sheetsApiGridLoaded = sheetResult.sheetsApiGridLoaded
      sourceLabel = 'Google Sheets'
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text()
      const params = new URLSearchParams(text)
      const ct = params.get('client_tier')?.trim()
      if (ct) clientTier = ct
      const sheetsUrl = String(params.get('url') ?? params.get('link') ?? '').trim()
      const sheetId = extractGoogleSheetsId(sheetsUrl)
      if (!sheetId) {
        return NextResponse.json({
          error: 'Invalid Google Sheets URL',
          hint: 'Paste a full link: docs.google.com/spreadsheets/d/...',
        }, { status: 400, headers: corsHeaders(origin) })
      }
      const sheetResult = await fetchGoogleSheetAsRows(sheetsUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`)
      rows = sheetResult.rows
      sheetsApiGridLoaded = sheetResult.sheetsApiGridLoaded
      sourceLabel = 'Google Sheets'
    } else if (contentType.includes('multipart/form-data')) {
      // File upload (Excel or CSV)
      const formData = await request.formData()
      const ctField = formData.get('client_tier')
      if (ctField != null && String(ctField).trim() !== '') {
        clientTier = String(ctField).trim()
      }
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
          if (body?.client_tier != null && String(body.client_tier).trim() !== '') {
            clientTier = String(body.client_tier).trim()
          }
          const sheetsUrl = String(body?.url ?? body?.link ?? body?.sheetUrl ?? '').trim()
          const sheetId = extractGoogleSheetsId(sheetsUrl) || (/^[a-zA-Z0-9_-]{40,}$/.test(sheetsUrl) ? sheetsUrl : null)
          if (sheetId) {
            const fetchUrl = sheetsUrl && (sheetsUrl.includes('docs.google.com') || sheetsUrl.includes('drive.google.com'))
              ? sheetsUrl
              : `https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`
            const sheetResult = await fetchGoogleSheetAsRows(fetchUrl)
            rows = sheetResult.rows
            sheetsApiGridLoaded = sheetResult.sheetsApiGridLoaded
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

    const headers = (rows[0] || []).map((h) => {
      if (h && typeof h === 'object' && 'text' in h) return String((h as ImportCell).text ?? '').trim()
      return ''
    })
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
    const skippedReasons: string[] = []

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
      urlStr = sanitizeImportUrlCandidate(urlStr)

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

      const normalizedUrl = normalizeImportProductUrl(urlStr)
      if (!normalizedUrl) {
        skipped++
        if (skippedReasons.length < 15) {
          skippedReasons.push(
            `Row ${i + 2}: no usable product link (add a Link/URL column with full https addresses, not link text only).`
          )
        }
        continue
      }

      try {
        const limitCheck = await checkItemLimitForApi(user.id, supabaseClient, clientTier)
        if (!limitCheck.allowed) {
          errors.push(`Row ${i + 2}: Item limit reached (${limitCheck.limit}). Upgrade for more.`)
          failed += dataRows.length - i - skipped
          break
        }

        const price = rawPrice ? parsePrice(rawPrice) : null
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
        try {
          retailer = new URL(normalizedUrl).hostname.replace('www.', '').split('.')[0]
        } catch {
          retailer = 'Import'
        }

        const insertData: Record<string, unknown> = {
          title: name || `Item from ${sourceLabel}`,
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

    const sheetsApiConfigured = Boolean(process.env.GOOGLE_SHEETS_API_KEY?.trim())
    let importHint: string | undefined
    if (sourceLabel === 'Google Sheets' && imported === 0 && skipped > 0) {
      if (!sheetsApiConfigured) {
        importHint =
          'Server is missing GOOGLE_SHEETS_API_KEY. Add a Google Cloud API key with the Sheets API enabled (restrict the key to that API). That lets imports read cell hyperlinks when the sheet only shows link text in CSV/exports.'
      } else if (!sheetsApiGridLoaded) {
        importHint =
          'Google Sheets API did not return usable grid data. Confirm the spreadsheet ID/gid, sharing (“Anyone with the link” as Viewer), and that the API key is not blocked by IP or application restrictions. You can also try File → Download → Microsoft Excel (.xlsx) and use the Excel/CSV import tab.'
      } else {
        importHint =
          'Sheet was loaded but no row had a normalizable product URL. Add a column of full https:// product links (not only link labels), use publish-to-web, or download as .xlsx.'
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
      skippedReasons: skippedReasons.slice(0, 10),
      importHint,
      sheetsApiConfigured,
      sheetsApiGridLoaded,
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
