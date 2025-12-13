'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getUserProducts, SupabaseProduct } from '@/lib/supabase/products'

interface WishlistGridProps {
  userId: string
  isOwner?: boolean
}

export default function WishlistGrid({ userId, isOwner = true }: WishlistGridProps) {
  const [products, setProducts] = useState<SupabaseProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load products
  const loadProducts = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await getUserProducts(userId, isOwner ? userId : undefined)

      if (fetchError) throw fetchError
      setProducts(data || [])
    } catch (err: any) {
      console.error('Error loading products:', err)
      setError(err.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (userId) {
      loadProducts()
    }
  }, [userId, isOwner])

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products',
          filter: `user_id=eq.${userId}`, // Only products for this user
        },
        (payload) => {
          console.log('Real-time update:', payload)
          
          // Reload products when changes occur
          loadProducts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block w-8 h-8 border-4 border-[var(--color-brand-blue)] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading wishlist...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={loadProducts}
          className="mt-4 px-4 py-2 text-white rounded-md transition-colors text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-brand-blue)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#a78bfa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-brand-blue)';
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎁</div>
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Your wishlist is empty
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          Start adding items to build your wishlist!
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => {
        const isReserved = !!product.reserved_by
        const priority = (product as any).meta?.priority || 'medium'

        return (
          <div
            key={product.id}
            className={`border rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm transition-all hover:shadow-md ${
              isReserved && !isOwner ? 'opacity-60' : ''
            }`}
          >
            {/* Image */}
            {product.image && (
              <img
                src={product.image}
                alt={product.title || 'Product'}
                className="w-full h-48 object-cover rounded mb-3"
              />
            )}

            {/* Title */}
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
              {product.title || 'Untitled Item'}
            </h3>

            {/* Price */}
            {product.price && (
              <p className="text-lg font-bold text-[var(--color-brand-blue)] mb-2">
                ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
              </p>
            )}

            {/* Priority Badge */}
            <div className="mb-3">
              <span
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  priority === 'high'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : priority === 'medium'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                }`}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
              </span>
            </div>

            {/* Reserved Status */}
            {isReserved && (
              <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {isOwner ? '✓ Reserved by someone' : '✗ Already reserved'}
                </p>
              </div>
            )}

            {/* Link */}
            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-[var(--color-brand-blue)] hover:underline mt-2"
              >
                View Product →
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

