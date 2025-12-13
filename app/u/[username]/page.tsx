'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getProfileByUsername, PublicProfile } from '@/lib/supabase/profile'
import { getUserProducts, SupabaseProduct, reserveProduct, unreserveProduct } from '@/lib/supabase/products'
import WishlistGrid from '@/components/wishlist/WishlistGrid'

export default function PublicProfilePage() {
  const params = useParams()
  const username = params?.username as string
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [products, setProducts] = useState<SupabaseProduct[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
    })
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!username) return

      try {
        setLoading(true)
        setError(null)

        // Fetch profile by username
        const { data: profileData, error: profileError } = await getProfileByUsername(username)

        if (profileError || !profileData) {
          setError('User not found')
          return
        }

        setProfile(profileData)

        // Load products for this user (public view)
        const { data: productsData, error: productsError } = await getUserProducts(
          profileData.id,
          currentUserId || undefined
        )

        if (productsError) {
          console.error('Error loading products:', productsError)
        } else if (productsData) {
          setProducts(productsData)
        }
      } catch (err: any) {
        console.error('Error loading profile:', err)
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [username, currentUserId])

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
      
      // Reload products
      if (profile) {
        const { data } = await getUserProducts(profile.id, currentUserId || undefined)
        if (data) {
          setProducts(data)
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update reservation')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-zinc-500">Loading wishlist...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-zinc-900 mb-2">User not found</p>
          <p className="text-sm text-zinc-500 mb-6">This wishlist doesn't exist or is private.</p>
          <a
            href="/"
            className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors inline-block"
          >
            Go Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex flex-col items-center gap-4">
            {/* Avatar */}
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || username}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center border-4 border-white shadow-lg">
                <span className="text-3xl font-medium text-white">
                  {profile.full_name?.[0]?.toUpperCase() || username[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}

            {/* Name */}
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900 mb-1">
                {profile.full_name || username}'s Wishlist
              </h1>
              <p className="text-sm text-zinc-500">@{username}</p>
            </div>
          </div>
        </div>

        {/* Wishlist Grid (Guest View) - Masonry Layout */}
        <WishlistGrid 
          items={products}
          isOwner={false}
          onReserve={handleReserve}
        />
      </div>
    </div>
  )
}

