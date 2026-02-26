'use client'

import { useState, useRef, useCallback } from 'react'
import { X, Upload, FileSpreadsheet, Globe, Loader2, CheckCircle2, AlertCircle, FileText, Link2, ShoppingCart, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/context'

interface ImportResult {
  total: number
  imported: number
  failed: number
  skipped?: number
  errors: string[]
  mapping?: {
    name: string | null
    price: string | null
    url: string | null
    image: string | null
  }
  source?: string
}

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

type Tab = 'spreadsheet' | 'sheets' | 'amazon'

export default function ImportModal({ isOpen, onClose, onComplete }: ImportModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('spreadsheet')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [sheetsUrl, setSheetsUrl] = useState('')
  const [amazonUrl, setAmazonUrl] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string[][] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setResult(null)
    setUploadedFile(null)
    setFilePreview(null)
    setSheetsUrl('')
    setAmazonUrl('')
    setImporting(false)
  }, [])

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setResult(null)

    try {
      const XLSX = await import('xlsx')
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      setFilePreview(rows.slice(0, 6))
    } catch {
      setFilePreview(null)
    }
  }

  const handleSpreadsheetImport = async () => {
    if (!uploadedFile) return
    setImporting(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', uploadedFile)

      const res = await fetch('/api/import-spreadsheet', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')

      setResult({
        total: json.total,
        imported: json.imported,
        failed: json.failed,
        skipped: json.skipped,
        errors: json.errors || [],
        mapping: json.mapping,
        source: json.source,
      })
      if (json.imported > 0) onComplete()
    } catch (err: any) {
      setResult({ total: 0, imported: 0, failed: 1, errors: [err.message] })
    } finally {
      setImporting(false)
    }
  }

  const handleSheetsImport = async () => {
    if (!sheetsUrl.trim()) return
    setImporting(true)
    setResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/import-spreadsheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: sheetsUrl.trim() }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')

      setResult({
        total: json.total,
        imported: json.imported,
        failed: json.failed,
        skipped: json.skipped,
        errors: json.errors || [],
        mapping: json.mapping,
        source: json.source,
      })
      if (json.imported > 0) onComplete()
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

      const res = await fetch('/api/import-amazon-wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: amazonUrl.trim() }),
      })

      const json = await res.json()
      if (!res.ok) {
        setResult({
          total: 0,
          imported: 0,
          failed: 1,
          errors: [json.error || 'Import failed'],
          source: 'Amazon',
        })
        return
      }

      setResult({
        total: json.total,
        imported: json.imported,
        failed: json.failed,
        errors: json.errors || [],
        source: json.source,
      })
      if (json.imported > 0) onComplete()
    } catch (err: any) {
      setResult({ total: 0, imported: 0, failed: 1, errors: [err.message] })
    } finally {
      setImporting(false)
    }
  }

  if (!isOpen) return null

  const tabs: { id: Tab; label: string; icon: typeof FileSpreadsheet }[] = [
    { id: 'spreadsheet', label: t('Excel / CSV'), icon: FileSpreadsheet },
    { id: 'sheets', label: t('Google Sheets'), icon: Link2 },
    { id: 'amazon', label: t('Amazon'), icon: ShoppingCart },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-beige-50 dark:bg-dpurple-900 rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-beige-50 dark:bg-dpurple-900 z-10 px-6 pt-6 pb-4 border-b border-beige-200 dark:border-dpurple-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('Import Items')}</h2>
            <button onClick={handleClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-beige-100 dark:hover:bg-dpurple-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-beige-100 dark:bg-dpurple-800 rounded-lg p-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setResult(null) }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-beige-50 dark:bg-dpurple-900 text-violet-700 dark:text-violet-400 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">

          {/* === SPREADSHEET TAB === */}
          {activeTab === 'spreadsheet' && (
            <>
              <div className="space-y-2">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('Upload an Excel (.xlsx) or CSV file. Wist will automatically detect columns for')} <span className="font-medium">{t('name')}</span>, <span className="font-medium">{t('price')}</span>, <span className="font-medium">{t('link')}</span>, {t('and')} <span className="font-medium">{t('image')}</span>.
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-beige-200 dark:border-dpurple-600 rounded-xl p-8 text-center cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/30 dark:hover:bg-violet-950/20 transition-colors"
                >
                  {uploadedFile ? (
                    <div className="space-y-1">
                      <FileText className="w-8 h-8 text-violet-500 mx-auto" />
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{uploadedFile.name}</p>
                      <p className="text-xs text-zinc-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('Click to upload')}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">.xlsx, .xls, .csv</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* File Preview */}
              {filePreview && filePreview.length > 0 && (
                <div className="rounded-lg border border-beige-200 dark:border-dpurple-600 overflow-hidden">
                  <div className="px-3 py-2 bg-beige-100 dark:bg-dpurple-800 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {t('Preview')} ({Math.min(filePreview.length - 1, 5)} {t('rows')})
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-beige-50 dark:bg-dpurple-800">
                          {filePreview[0]?.map((h, i) => (
                            <th key={i} className="px-3 py-1.5 text-left font-medium text-zinc-600 dark:text-zinc-400 border-b border-beige-200 dark:border-dpurple-600">{String(h)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreview.slice(1, 6).map((row, i) => (
                          <tr key={i} className="border-b border-beige-100 dark:border-dpurple-700 last:border-0">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">{String(cell)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={handleSpreadsheetImport}
                disabled={!uploadedFile || importing}
                className="w-full py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('Importing...')}</>
                ) : (
                  <><Upload className="w-4 h-4" /> {t('Import Spreadsheet')}</>
                )}
              </button>
            </>
          )}

          {/* === GOOGLE SHEETS TAB === */}
          {activeTab === 'sheets' && (
            <>
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('Paste a Google Sheets link. The sheet must be shared as "Anyone with the link can view".')}
                </p>
                <input
                  type="url"
                  value={sheetsUrl}
                  onChange={e => { setSheetsUrl(e.target.value); setResult(null) }}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full rounded-xl border border-beige-200 dark:border-dpurple-600 bg-beige-50 dark:bg-dpurple-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
                <div className="bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 text-xs text-violet-700 dark:text-violet-300 space-y-1">
                  <p className="font-medium">{t('How to share your Google Sheet:')}</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-violet-600 dark:text-violet-400">
                    <li>{t('Open your Google Sheet')}</li>
                    <li>{t('Click Share → "Anyone with the link"')}</li>
                    <li>{t('Set to "Viewer"')}</li>
                    <li>{t('Copy and paste the link above')}</li>
                  </ol>
                </div>
              </div>

              <button
                onClick={handleSheetsImport}
                disabled={!sheetsUrl.trim() || importing}
                className="w-full py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('Importing...')}</>
                ) : (
                  <><Link2 className="w-4 h-4" /> {t('Import from Google Sheets')}</>
                )}
              </button>
            </>
          )}

          {/* === AMAZON TAB === */}
          {activeTab === 'amazon' && (
            <>
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('Paste your Amazon wishlist URL. The wishlist must be set to')} <span className="font-medium">{t('Public')}</span>.
                </p>
                <input
                  type="url"
                  value={amazonUrl}
                  onChange={e => { setAmazonUrl(e.target.value); setResult(null) }}
                  placeholder="https://www.amazon.com/hz/wishlist/ls/..."
                  className="w-full rounded-xl border border-beige-200 dark:border-dpurple-600 bg-beige-50 dark:bg-dpurple-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                />
                <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-medium">{t('How to make your Amazon wishlist public:')}</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-600 dark:text-amber-400">
                    <li>{t('Go to your Amazon wishlist')}</li>
                    <li>{t('Click "..." → Manage list')}</li>
                    <li>{t('Set Privacy to "Public"')}</li>
                    <li>{t('Copy the page URL and paste above')}</li>
                  </ol>
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">
                  {t('Amazon may block automated access. If this doesn\'t work, try exporting your wishlist to a spreadsheet.')}
                </p>
              </div>

              <button
                onClick={handleAmazonImport}
                disabled={!amazonUrl.trim() || importing}
                className="w-full py-3 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('Importing...')}</>
                ) : (
                  <><ShoppingCart className="w-4 h-4" /> {t('Import from Amazon')}</>
                )}
              </button>
            </>
          )}

          {/* === RESULTS === */}
          {result && (
            <div className={`rounded-xl p-4 ${
              result.imported > 0
                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                {result.imported > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${result.imported > 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    {result.imported > 0
                      ? `${t('Imported')} ${result.imported} ${t('of')} ${result.total} ${t('items')}`
                      : t('Import failed')}
                  </p>

                  {/* Column mapping info */}
                  {result.mapping && result.imported > 0 && (
                    <div className="mt-2 text-xs text-green-700 dark:text-green-400 space-y-0.5">
                      <p className="font-medium">{t('Detected columns:')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.mapping.name && (
                          <span className="bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">{t('Name')}: {result.mapping.name}</span>
                        )}
                        {result.mapping.price && (
                          <span className="bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">{t('Price')}: {result.mapping.price}</span>
                        )}
                        {result.mapping.url && (
                          <span className="bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">{t('Link')}: {result.mapping.url}</span>
                        )}
                        {result.mapping.image && (
                          <span className="bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">{t('Image')}: {result.mapping.image}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {result.skipped && result.skipped > 0 && (
                    <p className="mt-1 text-xs text-zinc-500">{result.skipped} {t('empty rows skipped')}</p>
                  )}

                  {result.errors.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400">{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-xs text-red-500">...{t('and')} {result.errors.length - 5} {t('more errors')}</li>
                      )}
                    </ul>
                  )}

                  {result.imported > 0 && (
                    <p className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      {t('Items added to your queue. They\'ll appear on your dashboard shortly.')}
                    </p>
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
