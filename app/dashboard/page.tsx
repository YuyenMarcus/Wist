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
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

        // Load collections for "Move to" dropdown
        const { data: collectionsData } = await supabase
          .from('collections')
          .select('id, name, slug')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: true })
        
        if (collectionsData) {
          setCollections(collectionsData)
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

    // Real-time subscription for item changes
    // Only listen to items table (Your Personal List)
    const itemsChannel = supabase
      .channel('items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: user ? `user_id=eq.${user.id}` : undefined,
        },
        (payload) => {
          console.log('Real-time item update:', payload.eventType, payload.new)
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
      supabase.removeChannel(itemsChannel)
    }
  }, [router, user])

  const handleDelete = async (productId: string) => {
    if (!user) return
    
    if (!confirm('Are you sure you want to delete this item?')) return

    // 1. Optimistic Update
    setProducts(prev => prev.filter(p => p.id !== productId))

    try {
      // Get token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        alert("Please log in again.");
        return;
      }

      // 2. LOG the URL we are about to hit
      const url = `/api/delete-item?id=${productId}`;
      console.log("🚀 Sending DELETE request to:", url);

      // 3. Send request (ID is in the URL, not the body)
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        console.error("❌ Server Response:", data);
        throw new Error(data.message || 'Failed to delete');
      }
      
      console.log("✅ Deleted successfully!");
      // Refresh the list after successful delete
      await fetchItems();
    } catch (error: any) {
      console.error(error);
      alert("Could not delete item. Reloading...");
      // Re-fetch to restore UI if delete failed
      await fetchItems();
    }
  }

  const handleUpdate = (productId: string, updatedItem: SupabaseProduct) => {
    // Update the product in the local state
    setProducts(prev => prev.map(p => p.id === productId ? updatedItem : p))
  }

  // Function to fetch items (used by refresh)
  const fetchItems = async () => {
    if (!user) return
    const { data, error } = await getUserProducts(user.id, user.id)
    if (!error && data) {
      setProducts(data)
    }
  }

  async function handleRefreshPrices() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/cron/check-prices')
      const result = await res.json()
      if (result.success) {
        alert(`Scanned ${result.checked} items. Updated ${result.updates} prices.`)
      } else {
        alert('Failed to refresh prices: ' + (result.error || 'Unknown error'))
      }
      fetchItems() // Reload the list to see changes
    } catch (e: any) {
      console.error(e)
      alert('Failed to refresh prices: ' + (e.message || 'Network error'))
    } finally {
      setRefreshing(false)
    }
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
        onRefreshPrices={handleRefreshPrices}
        refreshing={refreshing}
      />

      {/* The Content Grid */}
      <main className="mt-8">
              <WishlistGrid 
                items={products}
                isOwner={true}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                userCollections={collections}
              />
      </main>
    </div>
  )
}