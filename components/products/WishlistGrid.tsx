'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getUserProducts, reserveProduct, unreserveProduct, SupabaseProduct } from '@/lib/supabase/products'

interface WishlistGridProps {
  userId: string
  isOwner?: boolean
}

export default function WishlistGrid({ userId, isOwner = false }: WishlistGridProps) {
  const [products, setProducts] = useState<SupabaseProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
    })
  }, [])

  // Load products
  const loadProducts = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await getUserProducts(
        userId,
        isOwner ? userId : currentUserId || undefined
      )

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
  }, [userId, isOwner, currentUserId])

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

  // Handle reserve/unreserve
  const handleReserve = async (productId: string) => {
    if (!currentUserId) {
      alert('Please log in to reserve items')
      return
    }

    const product = products.find(p => p.id === productId)
    if (!product) return

    const isReserved = product.reserved_by === currentUserId

    try {
      if (isReserved) {
        // Unreserve
        const { error } = await unreserveProduct(productId, currentUserId)
        if (error) throw error
      } else {
        // Reserve
        const { error } = await reserveProduct(productId, currentUserId)
        if (error) throw error
      }
      
      // Real-time subscription will update the UI automatically
    } catch (err: any) {
      alert(err.message || 'Failed to update reservation')
    }
  }

  // Handle delete (owner only)
  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('user_id', currentUserId)

      if (error) throw error
      
      // Real-time subscription will update the UI automatically
    } catch (err: any) {
      alert(err.message || 'Failed to delete item')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading wishlist...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadProducts}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No items in this wishlist yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => {
        const isReserved = !!product.reserved_by
        const isReservedByMe = product.reserved_by === currentUserId
        const priority = (product as any).meta?.priority || 'medium'

        return (
          <div
            key={product.id}
            className={`border rounded-lg p-4 bg-white shadow-sm ${
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
            <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
              {product.title || 'Untitled Item'}
            </h3>

            {/* Price */}
            {product.price && (
              <p className="text-lg font-bold text-blue-600 mb-2">
                ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
              </p>
            )}

            {/* Priority Badge */}
            <div className="mb-3">
              <span
                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                  priority === 'high'
                    ? 'bg-red-100 text-red-700'
                    : priority === 'medium'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
              </span>
            </div>

            {/* Reserved Status */}
            {isReserved && (
              <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  {isOwner
                    ? '✓ Reserved by someone'
                    : isReservedByMe
                    ? '✓ Reserved by you'
                    : '✗ Already reserved'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              {isOwner ? (
                <>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  {isReserved ? (
                    isReservedByMe ? (
                      <button
                        onClick={() => handleReserve(product.id)}
                        className="flex-1 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        Unreserve
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 px-3 py-2 bg-gray-300 text-gray-600 rounded cursor-not-allowed text-sm"
                      >
                        Already Reserved
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => handleReserve(product.id)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Reserve
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Link */}
            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-sm text-blue-600 hover:underline"
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

