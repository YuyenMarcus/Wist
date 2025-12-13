'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { getUserProducts, reserveProduct, unreserveProduct, SupabaseProduct } from '@/lib/supabase/products'

interface WishlistGridProps {
  userId: string
  isOwner?: boolean
}

// Generate gradient placeholder from initials
function getInitials(text: string): string {
  return text
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getGradientFromText(text: string): string {
  const colors = [
    'from-purple-400 to-pink-400',
    'from-blue-400 to-cyan-400',
    'from-green-400 to-emerald-400',
    'from-yellow-400 to-orange-400',
    'from-indigo-400 to-purple-400',
  ]
  const index = text.charCodeAt(0) % colors.length
  return colors[index]
}

export default function WishlistGrid({ userId, isOwner = true }: WishlistGridProps) {
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
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Real-time update:', payload)
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
        const { error } = await unreserveProduct(productId, currentUserId)
        if (error) throw error
      } else {
        const { error } = await reserveProduct(productId, currentUserId)
        if (error) throw error
      }
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
    } catch (err: any) {
      alert(err.message || 'Failed to delete item')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-zinc-500">Loading wishlist...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={loadProducts}
          className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-zinc-500">Your wishlist is empty</p>
      </div>
    )
  }

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12"
      layout
    >
      <AnimatePresence mode="popLayout">
        {products.map((product, index) => {
        const isReserved = !!product.reserved_by
        const isReservedByMe = product.reserved_by === currentUserId
        const priority = (product as any).meta?.priority || 'medium'
        const title = product.title || 'Untitled Item'
        const initials = getInitials(title)
        const gradient = getGradientFromText(title)

        return (
          <motion.div
            key={product.id}
            className="group relative"
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05,
              layout: { duration: 0.3 },
            }}
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 },
            }}
          >
            {/* Image Container */}
            <div className={`relative aspect-[4/5] rounded-xl overflow-hidden mb-3 transition-transform duration-300 group-hover:-translate-y-1 ${
              isReserved && !isOwner ? 'grayscale' : ''
            }`}>
              {product.image ? (
                <>
                  <img
                    src={product.image}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  {/* Reserved Overlay */}
                  {isReserved && !isOwner && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg">
                        <span className="text-xs font-medium text-zinc-900">Claimed</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <span className="text-2xl font-medium text-white/80">
                    {initials}
                  </span>
                </div>
              )}

              {/* Priority Dot */}
              <div className="absolute top-3 right-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    priority === 'high'
                      ? 'bg-red-500'
                      : priority === 'medium'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                />
              </div>

              {/* Action Buttons (Reveal on Hover) */}
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {isOwner ? (
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="px-3 py-1.5 bg-white/90 backdrop-blur-sm text-zinc-900 rounded-lg text-xs font-medium hover:bg-white transition-colors shadow-sm"
                  >
                    Delete
                  </button>
                ) : (
                  <>
                    {isReserved ? (
                      isReservedByMe ? (
                        <button
                          onClick={() => handleReserve(product.id)}
                          className="px-3 py-1.5 bg-white/90 backdrop-blur-sm text-zinc-900 rounded-lg text-xs font-medium hover:bg-white transition-colors shadow-sm"
                        >
                          Unreserve
                        </button>
                      ) : (
                        <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm text-zinc-500 rounded-lg text-xs font-medium">
                          Reserved
                        </div>
                      )
                    ) : (
                      <button
                        onClick={() => handleReserve(product.id)}
                        className="px-3 py-1.5 bg-white/90 backdrop-blur-sm text-zinc-900 rounded-lg text-xs font-medium hover:bg-white transition-colors shadow-sm"
                      >
                        Reserve
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Title and Price */}
            <div className="text-left">
              <h3 className="font-medium text-zinc-900 truncate text-sm mb-1">
                {title}
              </h3>
              {product.price && (
                <p className="text-zinc-500 text-xs">
                  ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                </p>
              )}
            </div>
          </motion.div>
        )
      })}
      </AnimatePresence>
    </motion.div>
  )
}
