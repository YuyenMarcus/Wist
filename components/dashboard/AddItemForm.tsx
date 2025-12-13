'use client'

import { useState } from 'react'
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
  const router = useRouter()

  // Fetch metadata when URL is pasted/changed
  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl)
    setError(null)
    setPreview(null)

    if (!newUrl.trim()) {
      return
    }

    // Validate URL
    try {
      new URL(newUrl.trim())
    } catch {
      setError('Invalid URL')
      return
    }

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
          is_public: false, // Default to private
          share_token: shareToken,
          // Store priority in meta JSONB
          meta: { priority },
        })

      if (insertError) throw insertError

      // Reset form
      setUrl('')
      setPreview(null)
      setPriority('medium')
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
    <div className="space-y-4">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Paste Product URL
        </label>
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://amazon.com/product/..."
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-4 py-3 shadow-sm focus:border-[var(--color-brand-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-blue)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            disabled={loading || saving}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[var(--color-brand-blue)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        {loading && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Fetching product data...</p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Success Toast */}
      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-green-800 dark:text-green-200 text-sm">
          ✓ Item added to wishlist successfully!
        </div>
      )}

      {/* Preview Card */}
      {preview && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Preview</h3>
          
          <div className="flex gap-4">
            {preview.image && (
              <img
                src={preview.image}
                alt={preview.title}
                className="w-24 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{preview.title}</p>
              {preview.price && (
                <p className="text-lg font-bold text-[var(--color-brand-blue)] mt-1">
                  ${typeof preview.price === 'number' ? preview.price.toFixed(2) : preview.price}
                </p>
              )}
              {preview.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {preview.description}
                </p>
              )}
            </div>
          </div>

          {/* Priority Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[var(--color-brand-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-blue)]"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full px-4 py-2 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-brand-blue)',
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = '#a78bfa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-brand-blue)';
            }}
          >
            {saving ? 'Adding...' : 'Add to Wishlist'}
          </button>
        </div>
      )}
    </div>
  )
}

