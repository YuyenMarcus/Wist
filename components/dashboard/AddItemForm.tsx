'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Puzzle, Check, Download } from 'lucide-react'

type Priority = 'high' | 'medium' | 'low'

interface PreviewData {
  title?: string
  image?: string
  price?: string | number
  description?: string
  url: string
  extensionRequired?: boolean
}

// Extension ID - update this if your extension ID changes
declare const chrome: any;
const EXTENSION_ID = typeof chrome !== 'undefined' ? chrome?.runtime?.id || '' : ''

export default function AddItemForm() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [priority, setPriority] = useState<Priority>('medium')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [scrapeMethod, setScrapeMethod] = useState<'extension' | 'server' | null>(null)
  const router = useRouter()

  // Check if extension is installed on mount
  useEffect(() => {
    const checkExtension = () => {
      // Method 1: Check for data attribute set by content script
      const hasAttribute = document.documentElement.getAttribute('data-wist-installed') === 'true'
      
      // Method 2: Try to communicate with the extension
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        // Try sending a ping to the extension
        try {
          // Get extension ID from manifest or use a known ID
          const extensionIds = [
            // Add your extension ID here after publishing
            // You can find it in chrome://extensions
          ]
          
          // For development, the extension might be using a dynamic ID
          // We rely on the content script setting the data attribute
        } catch (e) {
          console.log('Extension communication not available')
        }
      }
      
      setExtensionInstalled(hasAttribute)
      console.log('🧩 Extension installed:', hasAttribute)
    }
    
    // Check immediately and after a short delay (in case content script hasn't run yet)
    checkExtension()
    const timeout = setTimeout(checkExtension, 500)
    
    return () => clearTimeout(timeout)
  }, [])

  // Scrape using the extension (browser-based, avoids bot detection)
  const scrapeWithExtension = useCallback(async (targetUrl: string): Promise<PreviewData | null> => {
    return new Promise((resolve) => {
      console.log('🧩 Attempting extension-based scraping for:', targetUrl)
      
      // Send message to extension via window postMessage (content script will relay it)
      const messageId = `scrape-${Date.now()}`
      
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.type === 'WIST_SCRAPE_RESULT' && event.data?.messageId === messageId) {
          window.removeEventListener('message', handleResponse)
          
          if (event.data.success && event.data.data) {
            console.log('✅ Extension scrape successful:', event.data.data)
            resolve({
              title: event.data.data.title || 'Unknown Item',
              image: event.data.data.image || event.data.data.image_url || null,
              price: event.data.data.price || null,
              description: event.data.data.description || null,
              url: targetUrl,
            })
          } else {
            console.log('❌ Extension scrape failed:', event.data.error)
            resolve(null)
          }
        }
      }
      
      window.addEventListener('message', handleResponse)
      
      // Send scrape request to content script
      window.postMessage({
        type: 'WIST_SCRAPE_REQUEST',
        messageId,
        url: targetUrl,
      }, '*')
      
      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        console.log('⏱️ Extension scrape timed out')
        resolve(null)
      }, 30000)
    })
  }, [])

  // Scrape using server-side API (fallback)
  const scrapeWithServer = useCallback(async (targetUrl: string): Promise<PreviewData | null> => {
    console.log('🖥️ Using server-side scraping for:', targetUrl)
    
    const metadataUrl = `/api/metadata?url=${encodeURIComponent(targetUrl)}`
    const response = await fetch(metadataUrl)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch metadata' }))
      throw new Error(errorData.error || 'Failed to fetch product data')
    }

    const metadata = await response.json()
    console.log('🔍 Server metadata:', metadata)
    
    // Check if extension is recommended for better results
    if (metadata.extensionRequired && !extensionInstalled) {
      console.log('⚠️ Extension recommended for this site')
    }
    
    return {
      title: metadata.title || 'Unknown Item',
      image: metadata.imageUrl || null,
      price: metadata.price || null,
      description: metadata.description || null,
      url: targetUrl,
      extensionRequired: metadata.extensionRequired,
    }
  }, [extensionInstalled])

  // Fetch metadata when URL is pasted/changed
  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl)
    setError(null)
    setPreview(null)
    setScrapeMethod(null)

    if (!newUrl.trim()) {
      setIsExpanded(false)
      return
    }

    // Validate URL
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
      
      // Try extension-based scraping first if extension is installed
      if (extensionInstalled) {
        console.log('🧩 Extension detected, trying extension-based scraping...')
        previewData = await scrapeWithExtension(newUrl.trim())
        
        if (previewData && previewData.title && previewData.title !== 'Unknown Item') {
          setScrapeMethod('extension')
        }
      }
      
      // Fall back to server-side scraping if extension fails or is not installed
      if (!previewData || !previewData.title || previewData.title === 'Unknown Item') {
        console.log('🖥️ Falling back to server-side scraping...')
        previewData = await scrapeWithServer(newUrl.trim())
        setScrapeMethod('server')
      }
      
      if (previewData) {
        console.log('📦 Setting preview:', previewData)
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

  // Save to wishlist
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
      // 1. Fetch Metadata if we don't have preview yet
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
          image: metadataData.imageUrl || null, // API returns imageUrl, we map it to image
          price: metadataData.price || null,
          description: metadataData.description || null,
          url: url.trim(),
        }
      }

      // 2. Parse price if it's a string (e.g., "$99.99" -> 99.99)
      let priceValue: string | null = null
      if (metadata.price) {
        if (typeof metadata.price === 'string') {
          // Extract number from price string (handles "$99.99", "99.99", etc.)
          const priceMatch = metadata.price.replace(/[^0-9.]/g, '')
          priceValue = priceMatch ? parseFloat(priceMatch).toString() : null
        } else {
          priceValue = metadata.price.toString()
        }
      }

      // 3. Save to Supabase
      // Map API result (camelCase imageUrl) to DB columns (snake_case image)
      const insertData: any = {
        url: metadata.url,
        title: metadata.title || url.trim(), // Fallback to URL if title is missing
        image: metadata.image || null,       // Use metadata.image (from preview which has imageUrl mapped to image)
        price: priceValue,
        description: metadata.description || null,
        domain: new URL(metadata.url).hostname.replace('www.', ''),
        user_id: user.id,
      }

      // Only include meta if the column exists (handle gracefully if it doesn't)
      // Try to insert with meta first, if it fails, retry without meta
      let insertError: any = null
      try {
        const { error } = await supabase
          .from('products')
          .insert({
            ...insertData,
            meta: { priority },
          })
        
        insertError = error
        
        // If error is about meta column not found, retry without it
        if (error && (error.message?.includes('meta') || error.code === '42703')) {
          console.warn('meta column not found, saving without meta field')
          const { error: retryError } = await supabase
            .from('products')
            .insert(insertData)
          insertError = retryError
        }
      } catch (err: any) {
        insertError = err
      }

      if (insertError) {
        console.error('Supabase Error:', insertError)
        
        // Handle unique constraint violation (duplicate URL)
        if (insertError.code === '23505') {
          setError("You've already saved this link!")
          setSaving(false)
          return // Stop here, don't crash
        }
        
        // Provide helpful error message for meta column issues
        if (insertError.message?.includes('meta') || insertError.code === '42703') {
          throw new Error('Database schema issue: meta column may not exist. Please check your Supabase table schema or reload the schema cache in Settings -> API.')
        }
        
        throw insertError
      }

      // Success! Reset form
      setUrl('')
      setPreview(null)
      setPriority('medium')
      setIsExpanded(false)
      setSuccess(true)
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
      
      // Refresh the page or trigger real-time update
      router.refresh()
    } catch (err: any) {
      console.error('Error saving item:', err)
      setError(err.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Extension Status Indicator */}
      {extensionInstalled ? (
        <div className="flex items-center justify-center gap-2 mb-3 text-xs text-green-600">
          <Check className="w-3.5 h-3.5" />
          <span>Extension connected</span>
        </div>
      ) : (
        <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl">
          <div className="flex flex-col sm:flex-row items-start gap-3">
            <div className="p-2 bg-violet-100 rounded-lg flex-shrink-0">
              <Puzzle className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-zinc-900">Install our extension to add items from links</h4>
              <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                The Wist extension enables instant scraping from any shopping site including Amazon, Etsy, and more.
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

      {/* Magic Input Bar */}
      <div className="relative">
        <div
          className={`bg-white rounded-2xl border border-zinc-200 shadow-sm transition-all duration-300 ${
            isExpanded ? 'shadow-xl border-violet-200 ring-2 ring-violet-200' : ''
          } ${!extensionInstalled ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center h-14 px-4">
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onFocus={() => {
                if (url.trim()) setIsExpanded(true)
              }}
              placeholder={extensionInstalled ? "Paste a link to add to wishlist..." : "Install extension to paste links..."}
              className="flex-1 bg-transparent border-none outline-none text-zinc-900 placeholder-zinc-400 text-sm focus:ring-0"
              disabled={loading || saving || !extensionInstalled}
            />
            {loading && (
              <div className="ml-3">
                <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
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
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className="mt-3 overflow-hidden"
            >
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
                {/* Error Message */}
                {error && (
                  <div className="mb-3 text-xs text-red-600">
                    {error}
                  </div>
                )}

                {/* Success Toast */}
                {success && (
                  <div className="mb-3 text-xs text-green-600">
                    ✓ Item added to wishlist successfully!
                  </div>
                )}

                {/* Scrape Method Indicator */}
                {scrapeMethod === 'extension' && preview && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-green-600">
                    <Check className="w-3.5 h-3.5" />
                    <span>Scraped via extension</span>
                  </div>
                )}

                {/* Preview Card */}
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
                            ${typeof preview.price === 'number' ? preview.price.toFixed(2) : preview.price}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Priority Selector */}
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
