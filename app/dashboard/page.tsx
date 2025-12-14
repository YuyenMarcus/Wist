'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ProfileHeader from '@/components/dashboard/ProfileHeader'
import WishlistGrid from '@/components/wishlist/WishlistGrid'
import { getUserProducts, SupabaseProduct, deleteUserProduct } from '@/lib/supabase/products'
import { getProfile, Profile } from '@/lib/supabase/profile'
import LavenderLoader from '@/components/ui/LavenderLoader'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<SupabaseProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Load user, profile, and products
  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        setUser({ id: currentUser.id, email: currentUser.email })
        
        // Load profile
        const { data: profileData } = await getProfile(currentUser.id)
        if (profileData) {
          setProfile(profileData)
        }
        
        // Load products
        const { data, error } = await getUserProducts(currentUser.id, currentUser.id)
        if (!error && data) {
          setProducts(data)
        }
      }
      setLoading(false)
    }

    loadUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
        // Reload profile and products
        getProfile(session.user.id).then(({ data }) => {
          if (data) setProfile(data)
        })
        getUserProducts(session.user.id, session.user.id).then(({ data, error }) => {
          if (!error && data) {
            setProducts(data)
          }
        })
      } else {
        setUser(null)
        setProfile(null)
        setProducts([])
        router.push('/login')
      }
    })

    // Real-time subscription for product changes
    // Filter by user_id to only listen to changes to this user's products
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: user ? `user_id=eq.${user.id}` : undefined,
        },
        (payload) => {
          console.log('Real-time product update:', payload.eventType, payload.new)
          // Reload products on any change (but our manual updates should already be reflected)
          if (user) {
            getUserProducts(user.id, user.id).then(({ data, error }) => {
              if (!error && data) {
                setProducts(data)
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [router, user])

  const handleDelete = async (productId: string) => {
    if (!user) return
    
    if (!confirm('Are you sure you want to delete this item?')) return

    const { error } = await deleteUserProduct(user.id, productId)
    if (error) {
      alert('Failed to delete item: ' + error.message)
      return
    }

    // Update UI
    setProducts(prev => prev.filter(p => p.id !== productId))
  }

  const handleUpdate = (productId: string, updatedItem: SupabaseProduct) => {
    // Update the product in the local state
    setProducts(prev => prev.map(p => p.id === productId ? updatedItem : p))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <LavenderLoader size="lg" />
      </div>
    )
  }

  if (!user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-32">
      {/* Background grain or gradient for the dashboard too, but lighter */}
      <div className="fixed inset-0 z-[-1] bg-grid-pattern opacity-30 pointer-events-none" />

      {/* The Profile Header contains the Add Form */}
      <ProfileHeader 
        user={user} 
        profile={profile}
        itemCount={products.length}
      />

      {/* The Content Grid */}
      <main className="mt-8">
              <WishlistGrid 
                items={products}
                isOwner={true}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
      </main>
    </div>
  )
}
