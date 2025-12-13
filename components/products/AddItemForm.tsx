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
  const router = useRouter()

  // Fetch metadata when URL loses focus
  const handleUrlBlur = async () => {
    if (!url.trim()) {
      setPreview(null)
      return
    }

    // Validate URL
    try {
      new URL(url.trim())
    } catch {
      setError('Invalid URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Call your existing metadata fetcher
      const response = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: url.trim(), 
          save: false,
          user_id: (await supabase.auth.getUser()).data.user?.id 
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
        url: url.trim(),
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
      
      // Refresh the page or update the list
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          onBlur={handleUrlBlur}
          placeholder="https://amazon.com/product/..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          disabled={loading}
        />
        {loading && (
          <p className="mt-1 text-xs text-gray-500">Fetching product data...</p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Preview Card */}
      {preview && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="font-medium text-gray-900 mb-3">Preview</h3>
          
          <div className="flex gap-4">
            {preview.image && (
              <img
                src={preview.image}
                alt={preview.title}
                className="w-24 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">{preview.title}</p>
              {preview.price && (
                <p className="text-lg font-bold text-blue-600 mt-1">
                  ${typeof preview.price === 'number' ? preview.price.toFixed(2) : preview.price}
                </p>
              )}
              {preview.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {preview.description}
                </p>
              )}
            </div>
          </div>

          {/* Priority Selection */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    priority === p
                      ? p === 'high'
                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                        : p === 'medium'
                        ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300'
                        : 'bg-green-100 text-green-700 border-2 border-green-300'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save to Wishlist'}
          </button>
        </div>
      )}
    </div>
  )
}

