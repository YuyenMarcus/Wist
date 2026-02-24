'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, Globe, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface ImportResult {
  total: number
  imported: number
  failed: number
  errors: string[]
}

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

export default function ImportModal({ isOpen, onClose, onComplete }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<'csv' | 'amazon'>('csv')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [amazonUrl, setAmazonUrl] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setResult(null)
    setCsvFile(null)
    setCsvPreview([])
    setAmazonUrl('')
    setImporting(false)
  }, [])

  const handleClose = () => {
    resetState()
    onClose()
  }

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(l => l.trim())
    return lines.map(line => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      setCsvPreview(rows.slice(0, 6))
    }
    reader.readAsText(file)
  }

  const handleCSVImport = async () => {
    if (!csvFile) return
    setImporting(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const text = await csvFile.text()
      const rows = parseCSV(text)
      if (rows.length < 2) throw new Error('CSV must have at least a header row and one data row')

      const header = rows[0].map(h => h.toLowerCase().trim())
      const titleIdx = header.findIndex(h => ['title', 'name', 'item', 'product'].includes(h))
      const urlIdx = header.findIndex(h => ['url', 'link', 'product_url', 'product url'].includes(h))
      const priceIdx = header.findIndex(h => ['price', 'cost', 'amount'].includes(h))

      if (urlIdx === -1 && titleIdx === -1) {
        throw new Error('CSV must have at least a "title" or "url" column')
      }

      const dataRows = rows.slice(1)
      let imported = 0
      let failed = 0
      const errors: string[] = []

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]
        const title = titleIdx >= 0 ? row[titleIdx] : undefined
        const url = urlIdx >= 0 ? row[urlIdx] : undefined
        const rawPrice = priceIdx >= 0 ? row[priceIdx] : undefined

        if (!url && !title) {
          errors.push(`Row ${i + 2}: Missing both title and URL`)
          failed++
          continue
        }

        try {
          const price = rawPrice ? parseFloat(rawPrice.replace(/[^0-9.]/g, '')) : undefined

          const body: any = {
            title: title || `Imported item ${i + 1}`,
            url: url || '',
            status: url ? 'active' : 'queued',
          }
          if (price && !isNaN(price)) body.price = price

          const res = await fetch('/api/items', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(body),
          })

          const json = await res.json()
          if (!res.ok) {
            if (json.upgrade) {
              errors.push(`Row ${i + 2}: Item limit reached`)
              failed++
              break
            }
            throw new Error(json.error || 'Failed')
          }
          imported++
        } catch (err: any) {
          errors.push(`Row ${i + 2}: ${err.message}`)
          failed++
        }
      }

      setResult({ total: dataRows.length, imported, failed, errors })
      if (imported > 0) onComplete()
    } catch (err: any) {
      setResult({ total: 0, imported: 0, failed: 1, errors: [err.message] })
    } finally {
      setImporting(false)
    }
  }

  const handleAmazonImport = async () => {
    if (!amazonUrl.trim()) return
    setImporting(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const scraperUrl = process.env.NEXT_PUBLIC_SCRAPER_URL || '/api/metadata'
      const res = await fetch(`${scraperUrl}?url=${encodeURIComponent(amazonUrl.trim())}`)

      if (!res.ok) {
        setResult({
          total: 0,
          imported: 0,
          failed: 1,
          errors: ['Could not fetch Amazon wishlist. Make sure the wishlist is set to Public and the URL is correct.'],
        })
        return
      }

      const data = await res.json()
      if (!data.title) {
        setResult({
          total: 1,
          imported: 0,
          failed: 1,
          errors: ['Amazon wishlist page scraping is not yet available. Please use CSV import instead, or add items individually.'],
        })
        return
      }

      const addRes = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: data.title,
          url: amazonUrl.trim(),
          price: data.price ? parseFloat(String(data.price).replace(/[^0-9.]/g, '')) : undefined,
          image_url: data.imageUrl || data.image,
        }),
      })

      if (addRes.ok) {
        setResult({ total: 1, imported: 1, failed: 0, errors: [] })
        onComplete()
      } else {
        const json = await addRes.json()
        setResult({ total: 1, imported: 0, failed: 1, errors: [json.error || 'Failed to add item'] })
      }
    } catch (err: any) {
      setResult({ total: 0, imported: 0, failed: 1, errors: [err.message] })
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">Import Items</h2>
            <button onClick={handleClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-1 mt-4 bg-zinc-100 rounded-lg p-1">
            <button
              onClick={() => { setActiveTab('csv'); setResult(null) }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'csv' ? 'bg-white text-violet-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              CSV / Spreadsheet
            </button>
            <button
              onClick={() => { setActiveTab('amazon'); setResult(null) }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'amazon' ? 'bg-white text-violet-700 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              <Globe className="w-4 h-4" />
              Amazon Wishlist
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {activeTab === 'csv' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-zinc-600">
                  Upload a CSV file with columns for <span className="font-medium">title</span>, <span className="font-medium">url</span>, and optionally <span className="font-medium">price</span>.
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
                >
                  {csvFile ? (
                    <div className="space-y-1">
                      <FileText className="w-8 h-8 text-violet-500 mx-auto" />
                      <p className="text-sm font-medium text-zinc-900">{csvFile.name}</p>
                      <p className="text-xs text-zinc-500">{(csvFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-zinc-300 mx-auto" />
                      <p className="text-sm text-zinc-500">Click to upload a CSV file</p>
                      <p className="text-xs text-zinc-400">Supports .csv files</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {csvPreview.length > 0 && (
                <div className="rounded-lg border border-zinc-200 overflow-hidden">
                  <div className="px-3 py-2 bg-zinc-50 text-xs font-medium text-zinc-500">Preview ({csvPreview.length > 5 ? '5' : csvPreview.length - 1} rows)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-50">
                          {csvPreview[0]?.map((h, i) => (
                            <th key={i} className="px-3 py-1.5 text-left font-medium text-zinc-600 border-b border-zinc-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(1, 6).map((row, i) => (
                          <tr key={i} className="border-b border-zinc-100 last:border-0">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-1.5 text-zinc-700 truncate max-w-[150px]">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={handleCSVImport}
                disabled={!csvFile || importing}
                className="w-full py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import CSV
                  </>
                )}
              </button>
            </>
          )}

          {activeTab === 'amazon' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-zinc-600">
                  Paste your Amazon wishlist URL. The wishlist must be set to <span className="font-medium">Public</span>.
                </p>
                <input
                  type="url"
                  value={amazonUrl}
                  onChange={e => setAmazonUrl(e.target.value)}
                  placeholder="https://www.amazon.com/hz/wishlist/ls/..."
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <p className="text-xs text-zinc-400">
                  Note: Full wishlist import is being rolled out. Currently, single Amazon product URLs work best.
                </p>
              </div>

              <button
                onClick={handleAmazonImport}
                disabled={!amazonUrl.trim() || importing}
                className="w-full py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Import from Amazon
                  </>
                )}
              </button>
            </>
          )}

          {result && (
            <div className={`rounded-xl p-4 ${result.imported > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start gap-3">
                {result.imported > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${result.imported > 0 ? 'text-green-800' : 'text-red-800'}`}>
                    {result.imported > 0
                      ? `Imported ${result.imported} of ${result.total} items`
                      : 'Import failed'}
                  </p>
                  {result.errors.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="text-xs text-red-600">{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-xs text-red-500">...and {result.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
