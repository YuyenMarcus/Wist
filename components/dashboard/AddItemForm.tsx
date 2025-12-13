'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Priority = 'high' | 'medium' | 'low'

interface PreviewData {
  title?: string
  image?: string
  price?: string | number
  description?: string
  url: string
}

export default function AddItemForm() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [priority, setPriority] = useState<Priority>('medium')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const router = useRouter()

  // Debug: Verify state connection - log when preview changes
  useEffect(() => {
    if (preview) {
      console.log('🔄 Preview state updated:', {
        hasImage: !!preview.image,
        imageUrl: preview.image,
        title: preview.title,
      })
    } else {
      console.log('🔄 Preview state cleared')
    }
  }, [preview])

  // Fetch metadata when URL is pasted/changed
  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl)
    setError(null)
    setPreview(null)

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
      // Fetch metadata from the new metadata API
      const metadataUrl = `/api/metadata?url=${encodeURIComponent(newUrl.trim())}`
      const response = await fetch(metadataUrl)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch metadata' }))
        throw new Error(errorData.error || 'Failed to fetch product data')
      }

      const metadata = await response.json()

      // Debug: Log the fetched metadata to see what we're getting
      console.log('🔍 Fetched metadata:', metadata)
      
      const previewData = {
        title: metadata.title || 'Unknown Item',
        image: metadata.imageUrl || null, // API returns imageUrl, we store it as image
        price: metadata.price || null,
        description: metadata.description || null,
        url: newUrl.trim(),
      }
      
      console.log('📦 Setting preview with image:', previewData.image)
      setPreview(previewData)
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
      {/* Magic Input Bar */}
      <div className="relative">
        <div
          className={`bg-white rounded-2xl border border-zinc-200 shadow-sm transition-all duration-300 ${
            isExpanded ? 'shadow-xl border-violet-200 ring-2 ring-violet-200' : ''
          }`}
        >
          <div className="flex items-center h-14 px-4">
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onFocus={() => {
                if (url.trim()) setIsExpanded(true)
              }}
              placeholder="Paste a link to add to wishlist..."
              className="flex-1 bg-transparent border-none outline-none text-zinc-900 placeholder-zinc-400 text-sm focus:ring-0"
              disabled={loading || saving}
            />
            {loading && (
              <div className="ml-3">
                <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
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

                {/* Preview Card */}
                {preview && (
                  <div className="mb-4">
                    {/* Debug info (remove in production) */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mb-2 p-2 bg-zinc-50 rounded text-xs text-zinc-600 border border-zinc-200">
                        <div><strong>State Check:</strong></div>
                        <div>preview.image = {preview.image ? `"${preview.image}"` : 'null'}</div>
                        <div>preview.image exists? {preview.image ? '✅ YES' : '❌ NO'}</div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      {preview.image ? (
                        <img
                          key={preview.image} // Force re-render if image URL changes
                          src={preview.image}
                          alt={preview.title || 'Product preview'}
                          className="w-12 h-12 object-cover rounded border border-zinc-200"
                          onLoad={() => {
                            console.log('✅ Image loaded successfully:', preview.image)
                          }}
                          onError={(e) => {
                            // Fallback if image fails to load
                            console.error('❌ Image failed to load:', preview.image)
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
