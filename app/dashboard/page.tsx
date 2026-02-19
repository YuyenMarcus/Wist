'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ProfileHeader from '@/components/dashboard/ProfileHeader'
import ExtensionBanner from '@/components/dashboard/ExtensionBanner'
import WishlistGrid from '@/components/wishlist/WishlistGrid'
import ProductCard from '@/components/dashboard/ProductCard'
import { getUserProducts, SupabaseProduct, deleteUserProduct } from '@/lib/supabase/products'
import { getProfile, Profile } from '@/lib/supabase/profile'
import LavenderLoader from '@/components/ui/LavenderLoader'
import { Layers, LayoutGrid, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<SupabaseProduct[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoOrganizing, setAutoOrganizing] = useState(false)
  const [autoOrganizeStats, setAutoOrganizeStats] = useState<{
    canAutoCategorize: number;
    uncategorized: number;
  } | null>(null)

  // Determine view mode from URL parameter
  const viewMode = searchParams?.get('view') === 'grouped' ? 'grouped' : 'timeline'

  // Group items by collection for the Categories view - use useMemo to ensure proper computation
  const groupedItems = useMemo(() => {
    if (!products.length) {
      return []
    }
    
    // If no collections, return empty array (items will show in uncategorized)
    if (!collections.length) {
      return []
    }
    
    const grouped = collections.map(col => {
      const items = products.filter((item: any) => {
        const itemCollectionId = item.collection_id?.toString() || null
        const collectionId = col.id?.toString() || null
        return itemCollectionId === collectionId && itemCollectionId !== null
      })
      
      return {
        ...col,
        items
      }
    })
    
    return grouped
  }, [collections, products])

  const uncategorizedItems = useMemo(() => {
    const uncategorized = products.filter((item: any) => {
      const hasCollectionId = item.collection_id !== null && item.collection_id !== undefined && item.collection_id !== ''
      return !hasCollectionId
    })
    
    // Debug logging
    if (viewMode === 'grouped') {
      console.log('📦 Uncategorized items:', {
        count: uncategorized.length,
        items: uncategorized.map((i: any) => ({ id: i.id, title: i.title, collection_id: i.collection_id }))
      })
    }
    
    return uncategorized
  }, [products, viewMode])

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
          
          // Seed price history for items that have no entries yet (runs once, non-blocking)
          fetch('/api/seed-price-history', { method: 'POST' }).catch(() => {})
        }

        // Load collections for "Move to" dropdown and Categories view
        const { data: collectionsData, error: collectionsError } = await supabase
          .from('collections')
          .select('id, name, slug, created_at, icon, color')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: true })
        
        if (collectionsError) {
          console.error('Error fetching collections:', collectionsError);
        }
        
        if (collectionsData) {
          console.log('📦 Collections loaded:', collectionsData.length, collectionsData.map((c: any) => ({ name: c.name, id: c.id })));
          setCollections(collectionsData)  // Already sorted by created_at from query
        } else {
          console.log('⚠️ No collections found');
          setCollections([])
        }
      }
      
      // Wait a tiny bit to ensure collections state is updated
      setTimeout(() => setLoading(false), 50)  // Small delay to ensure state updates
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

    // Real-time subscription for profile changes
    const profileChannel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: user ? `id=eq.${user.id}` : undefined,
        },
        (payload) => {
          console.log('Real-time profile update:', payload.eventType, payload.new)
          if (user) {
            getProfile(user.id).then(({ data }) => {
              if (data) setProfile(data)
            })
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
      supabase.removeChannel(itemsChannel)
      supabase.removeChannel(profileChannel)
    }
  }, [router])

  // Refresh profile when page becomes visible (user returns from account page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        getProfile(user.id).then(({ data }) => {
          if (data) setProfile(data)
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user])

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

  // Fetch auto-categorize stats when in grouped view
  useEffect(() => {
    async function fetchAutoOrganizeStats() {
      if (viewMode !== 'grouped' || !user) return
      
      try {
        const res = await fetch('/api/items/auto-categorize', {
          credentials: 'include'
        })
        const data = await res.json()
        if (data.success && data.stats) {
          setAutoOrganizeStats({
            canAutoCategorize: data.stats.canAutoCategorize,
            uncategorized: data.stats.uncategorized
          })
        }
      } catch (e) {
        console.error('Failed to fetch auto-organize stats:', e)
      }
    }
    
    fetchAutoOrganizeStats()
  }, [viewMode, user, products])

  async function handleAutoOrganize() {
    if (autoOrganizing) return
    
    setAutoOrganizing(true)
    try {
      // First, preview what will be categorized
      const previewRes = await fetch('/api/items/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preview: true, minConfidence: 'medium' })
      })
      const previewData = await previewRes.json()
      
      if (!previewData.success) {
        throw new Error(previewData.error || 'Failed to preview')
      }
      
      if (previewData.suggestions.length === 0) {
        alert('No items could be auto-categorized. Try creating more collections or adding items with clearer titles.')
        setAutoOrganizing(false)
        return
      }
      
      // Show confirmation with preview
      const confirmMessage = `Auto-organize will categorize ${previewData.suggestions.length} item(s):\n\n` +
        previewData.suggestions.slice(0, 5).map((s: any) => 
          `• "${s.itemTitle?.substring(0, 30)}..." → ${s.collectionName}`
        ).join('\n') +
        (previewData.suggestions.length > 5 ? `\n\n...and ${previewData.suggestions.length - 5} more` : '') +
        '\n\nProceed?'
      
      if (!confirm(confirmMessage)) {
        setAutoOrganizing(false)
        return
      }
      
      // Apply the categorization
      const applyRes = await fetch('/api/items/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preview: false, minConfidence: 'medium' })
      })
      const applyData = await applyRes.json()
      
      if (!applyData.success) {
        throw new Error(applyData.error || 'Failed to apply')
      }
      
      alert(`✨ Successfully organized ${applyData.applied} item(s)!`)
      
      // Refresh the items list
      await fetchItems()
      
      // Update stats
      setAutoOrganizeStats({
        canAutoCategorize: 0,
        uncategorized: applyData.stats.uncategorized - applyData.applied
      })
      
    } catch (e: any) {
      console.error('Auto-organize error:', e)
      alert('Failed to auto-organize: ' + (e.message || 'Unknown error'))
    } finally {
      setAutoOrganizing(false)
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
    <div className="min-h-screen bg-white pb-32">

      {/* Extension Banner - High Visibility */}
      <ExtensionBanner />

      {/* The Profile Header contains the Add Form */}
      <ProfileHeader 
        user={user} 
        profile={profile}
        itemCount={products.length}
        onRefreshPrices={handleRefreshPrices}
        refreshing={refreshing}
      />

      {/* The Content Grid */}
      <main className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Timeline View (Pinterest Grid) */}
        {viewMode === 'timeline' && (
          <WishlistGrid 
            items={products}
            isOwner={true}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            userCollections={collections}
          />
        )}

        {/* Categories View (Grouped by Collection) */}
        {viewMode === 'grouped' && (
          <div className="space-y-12">
            {/* Auto-organize Banner - Stacks on mobile */}
            {autoOrganizeStats && autoOrganizeStats.canAutoCategorize > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl px-4 sm:px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-100 rounded-lg flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {autoOrganizeStats.canAutoCategorize} item{autoOrganizeStats.canAutoCategorize !== 1 ? 's' : ''} can be auto-organized
                    </p>
                    <p className="text-xs text-zinc-500">
                      Based on item names and your collections
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAutoOrganize}
                  disabled={autoOrganizing}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0 w-full sm:w-auto"
                >
                  {autoOrganizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Organizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Auto-organize
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Show all items if no collections exist */}
            {collections.length === 0 && products.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-zinc-900 mb-4 flex items-center gap-2">
                  All Items
                  <span className="text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">
                    {products.length}
                  </span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {products.map((item: any) => (
                    <ProductCard 
                      key={item.id} 
                      item={item} 
                      userCollections={collections} 
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Uncategorized Section */}
            {collections.length > 0 && uncategorizedItems.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2 opacity-50">
                  <span className="w-2 h-2 rounded-full bg-zinc-300"></span>
                  Uncategorized
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                  {uncategorizedItems.map((item: any) => (
                    <ProductCard 
                      key={item.id} 
                      item={item} 
                      userCollections={collections} 
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Collection Sections */}
            {collections.length > 0 && groupedItems.map(group => (
              group.items.length > 0 && (
                <section key={group.id} className="pt-8 border-t border-zinc-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                      {group.name}
                      <span className="text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">
                        {group.items.length}
                      </span>
                    </h2>
                    <Link 
                      href={`/dashboard/collection/${group.slug}`} 
                      className="text-sm text-violet-600 hover:text-violet-700 hover:underline transition-colors"
                    >
                      View Page →
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                    {group.items.map((item: any) => (
                      <ProductCard 
                        key={item.id} 
                        item={item} 
                        userCollections={collections} 
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </section>
              )
            ))}

            {/* Empty State for Grouped View */}
            {products.length === 0 && (
              <div className="text-center py-20 text-zinc-500">
                No items found. Add some items to see them here!
              </div>
            )}

            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && viewMode === 'grouped' && (
              <div className="mt-8 p-4 bg-zinc-100 rounded-lg text-xs">
                <div>Debug Info:</div>
                <div>View Mode: {viewMode}</div>
                <div>Products Count: {products.length}</div>
                <div>Collections Count: {collections.length}</div>
                <div>Grouped Items Count: {groupedItems.length}</div>
                <div>Uncategorized Items Count: {uncategorizedItems.length}</div>
                <div>Products with collection_id: {products.filter((p: any) => p.collection_id).length}</div>
                <div>Products without collection_id: {products.filter((p: any) => !p.collection_id).length}</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}