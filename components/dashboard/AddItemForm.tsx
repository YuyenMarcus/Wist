'use client'

import { useState } from 'react'
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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Please log in to add items')
      }

      // Call your existing metadata fetcher
      const response = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: newUrl.trim(), 
          save: false,
          user_id: user.id 
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch product data')
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch product')
      }

      setPreview({
        title: data.title || 'Unknown Item',
        image: data.image || null,
        price: data.price || null,
        description: data.description || null,
        url: newUrl.trim(),
      })
    } catch (err: any) {
      setError(err.message || 'Failed to fetch product data')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  // Save to wishlist
  const handleSave = async () => {
    if (!preview) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Please log in to save items')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      // Generate share token for public sharing
      const shareToken = Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15)

      const { error: insertError } = await supabase
        .from('products')
        .insert({
          url: preview.url,
          title: preview.title || null,
          image: preview.image || null,
          price: typeof preview.price === 'number' 
            ? preview.price.toString() 
            : preview.price || null,
          description: preview.description || null,
          domain: new URL(preview.url).hostname.replace('www.', ''),
          user_id: user.id,
          is_public: false,
          share_token: shareToken,
          meta: { priority },
        })

      if (insertError) throw insertError

      // Reset form
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
            isExpanded ? 'shadow-xl border-zinc-300' : ''
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
              className="flex-1 bg-transparent border-none outline-none text-zinc-900 placeholder-zinc-400 text-sm"
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
                className="ml-3 h-8 px-4 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              transition={{ duration: 0.2 }}
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
                    <div className="flex items-center gap-3">
                      {preview.image && (
                        <img
                          src={preview.image}
                          alt={preview.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">
                          {preview.title}
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
