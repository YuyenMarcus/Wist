'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Puzzle, Check, Download, Smartphone, Link as LinkIcon } from 'lucide-react'

type Priority = 'high' | 'medium' | 'low'

interface PreviewData {
  title?: string
  image?: string
  price?: string | number
  description?: string
  url: string
  extensionRequired?: boolean
  currency?: string
}

declare const chrome: any;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || ''
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768
      setIsMobile(mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

function useFakeProgress(isActive: boolean) {
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isActive) {
      setProgress(0)
      let current = 0
      const tick = () => {
        current += current < 30 ? 8 : current < 60 ? 3 : current < 80 ? 1 : 0.3
        if (current > 92) current = 92
        setProgress(current)
      }
      intervalRef.current = setInterval(tick, 200)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (progress > 0) {
        setProgress(100)
        const t = setTimeout(() => setProgress(0), 400)
        return () => clearTimeout(t)
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActive])

  return progress
}

export default function AddItemForm() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [priority, setPriority] = useState<Priority>('medium')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [scrapeMethod, setScrapeMethod] = useState<'extension' | 'server' | null>(null)
  const progress = useFakeProgress(loading)
  const router = useRouter()
  const isMobile = useIsMobile()

  useEffect(() => {
    const checkExtension = () => {
      const hasAttribute = document.documentElement.getAttribute('data-wist-installed') === 'true'
      setExtensionInstalled(hasAttribute)
    }
    checkExtension()
    const timeout = setTimeout(checkExtension, 500)
    return () => clearTimeout(timeout)
  }, [])

  const scrapeWithExtension = useCallback(async (targetUrl: string): Promise<PreviewData | null> => {
    return new Promise((resolve) => {
      const messageId = `scrape-${Date.now()}`
      
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'WIST_SCRAPE_RESULT' && event.data?.messageId === messageId) {
          window.removeEventListener('message', handleResponse)
          
          if (event.data.success && event.data.data) {
            resolve({
              title: event.data.data.title || 'Unknown Item',
              image: event.data.data.image || event.data.data.image_url || null,
              price: event.data.data.price || null,
              description: event.data.data.description || null,
              url: targetUrl,
              currency: event.data.data.currency || 'USD',
            })
          } else {
            resolve(null)
          }
        }
      }
      
      window.addEventListener('message', handleResponse)
      window.postMessage({ type: 'WIST_SCRAPE_REQUEST', messageId, url: targetUrl }, '*')
      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve(null)
      }, 30000)
    })
  }, [])

  const scrapeWithServer = useCallback(async (targetUrl: string): Promise<PreviewData | null> => {
    const response = await fetch(`/api/metadata?url=${encodeURIComponent(targetUrl)}`)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch metadata' }))
      throw new Error(errorData.error || 'Failed to fetch product data')
    }

    const metadata = await response.json()
    
    return {
      title: metadata.title || 'Unknown Item',
      image: metadata.imageUrl || null,
      price: metadata.price || null,
      description: metadata.description || null,
      url: targetUrl,
      extensionRequired: metadata.extensionRequired,
      currency: metadata.currency || 'USD',
    }
  }, [])

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl)
    setError(null)
    setPreview(null)
    setScrapeMethod(null)

    if (!newUrl.trim()) {
      setIsExpanded(false)
      return
    }

    try {
      new URL(newUrl.trim())
    } catch {
      setError('Invalid URL')
      setIsExpanded(false)
      return
    }

    setIsExpanded(true)
    setLoading(true)

    try {
      let previewData: PreviewData | null = null
      
      if (extensionInstalled && !isMobile) {
        previewData = await scrapeWithExtension(newUrl.trim())
        if (previewData && previewData.title && previewData.title !== 'Unknown Item') {
          setScrapeMethod('extension')
        }
      }
      
      if (!previewData || !previewData.title || previewData.title === 'Unknown Item') {
        previewData = await scrapeWithServer(newUrl.trim())
        setScrapeMethod('server')
      }
      
      if (previewData) {
        setPreview(previewData)
      } else {
        throw new Error('Could not fetch product data')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch product data')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!url.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Please log in to save items')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      let metadata = preview
      if (!metadata || !metadata.title) {
        const metadataUrl = `/api/metadata?url=${encodeURIComponent(url.trim())}`
        const metadataResponse = await fetch(metadataUrl)
        
        if (!metadataResponse.ok) {
          throw new Error('Failed to fetch metadata')
        }
        
        const metadataData = await metadataResponse.json()
        metadata = {
          title: metadataData.title || url.trim(),
          image: metadataData.imageUrl || null,
          price: metadataData.price || null,
          description: metadataData.description || null,
          url: url.trim(),
        }
      }

      let priceValue: string | null = null
      if (metadata.price) {
        if (typeof metadata.price === 'string') {
          const priceMatch = metadata.price.replace(/[^0-9.]/g, '')
          priceValue = priceMatch ? priceMatch : null
        } else {
          priceValue = metadata.price.toString()
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          url: metadata.url,
          title: metadata.title || url.trim(),
          price: priceValue,
          image_url: metadata.image || null,
          currency: metadata.currency || 'USD',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.upgrade) {
          setError(`Item limit reached (${result.current}/${result.limit}). Upgrade your plan to add more items.`)
          setSaving(false)
          return
        }
        throw new Error(result.error || 'Failed to save item')
      }

      const wasQueued = result.item?.status === 'queued'

      setUrl('')
      setPreview(null)
      setPriority('medium')
      setIsExpanded(false)
      setSuccess(true)
      setSuccessMessage(wasQueued
        ? 'Saved to queue! Full details will load on desktop with the extension.'
        : 'Item added to wishlist!')
      setTimeout(() => setSuccess(false), wasQueued ? 5000 : 3000)
      router.refresh()
      window.location.reload()
    } catch (err: any) {
      console.error('Error saving item:', err)
      setError(err.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const canPasteLinks = isMobile || extensionInstalled
  const showExtensionPrompt = !isMobile && !extensionInstalled

  return (
    <div className="max-w-2xl mx-auto">
      {/* Extension / mobile status */}
      {extensionInstalled && !isMobile ? (
        <div className="flex items-center justify-center gap-2 mb-3 text-xs text-green-600">
          <Check className="w-3.5 h-3.5" />
          <span>Extension connected</span>
        </div>
      ) : isMobile ? (
        <div className="flex items-center justify-center gap-2 mb-3 text-xs text-violet-600">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Paste a link or use Share to save items</span>
        </div>
      ) : null}

      {/* Desktop: Extension prompt (non-blocking) */}
      {showExtensionPrompt && (
        <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl">
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <div className="p-2 bg-violet-100 rounded-lg flex-shrink-0">
              <Puzzle className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-zinc-900">Install the extension for the best experience</h4>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                The Wist extension enables one-click saving from any shopping site. You can also paste links below.
              </p>
              <a
                href="/wist-extension-download.zip"
                download
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Extension
              </a>
            </div>
          </div>
        </div>
      )}

      {/* URL Input - always enabled */}
      <div className="relative">
        <div
          className={`relative bg-white rounded-2xl border border-zinc-200 shadow-sm transition-all duration-300 overflow-hidden ${
            isExpanded ? 'shadow-xl border-violet-200 ring-2 ring-violet-200' : ''
          }`}
        >
          <div className="flex items-center h-14 px-4">
            <LinkIcon className="w-4 h-4 text-zinc-400 mr-2 flex-shrink-0" />
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onFocus={() => {
                if (url.trim()) setIsExpanded(true)
              }}
              placeholder="Paste a product link..."
              className="flex-1 bg-transparent border-none outline-none text-zinc-900 placeholder-zinc-400 text-sm focus:ring-0"
              disabled={loading || saving}
            />
            {loading && (
              <div className="ml-3 flex items-center gap-2">
                <span className="text-xs text-zinc-400 tabular-nums">{Math.round(progress)}%</span>
              </div>
            )}
            {isExpanded && !loading && preview && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="ml-3 h-8 px-4 bg-violet-500 text-white rounded-full text-xs font-medium hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-violet-200"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            )}
          </div>
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100 rounded-b-2xl overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="mt-3 overflow-hidden"
            >
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
                {loading && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
                    <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                    <span>
                      {progress < 20 ? 'Connecting...' :
                       progress < 50 ? 'Loading page...' :
                       progress < 75 ? 'Extracting product data...' :
                       'Almost there...'}
                    </span>
                  </div>
                )}

                {error && (
                  <div className="mb-3 text-xs text-red-600">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-3 text-xs text-green-600">
                    {successMessage || 'Item added to wishlist!'}
                  </div>
                )}

                {scrapeMethod === 'extension' && preview && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-green-600">
                    <Check className="w-3.5 h-3.5" />
                    <span>Scraped via extension</span>
                  </div>
                )}

                {preview && (
                  <div className="mb-4">
                    <div className="flex items-center gap-3">
                      {preview.image ? (
                        <img
                          key={preview.image}
                          src={preview.image}
                          alt={preview.title || 'Product preview'}
                          className="w-12 h-12 object-cover rounded border border-zinc-200"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-pink-100 rounded flex items-center justify-center border border-zinc-200">
                          <span className="text-xs text-violet-600 font-medium">
                            {(preview.title || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {preview.title || 'Untitled Item'}
                        </p>
                        {preview.price && (
                          <p className="text-xs text-zinc-500 mt-0.5">
                            ${typeof preview.price === 'number' ? preview.price.toFixed(2) : preview.price.toString().replace(/^\$/, '')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {preview?.extensionRequired && !extensionInstalled && !isMobile && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    This site may have limited data. Install the extension for better results.
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500">Priority:</label>
                  <div className="flex gap-1">
                    {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          priority === p
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
