'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ProfileHeader from '@/components/dashboard/ProfileHeader'
import ExtensionBanner from '@/components/dashboard/ExtensionBanner'
import WishlistGrid from '@/components/wishlist/WishlistGrid'
import ProductCard from '@/components/dashboard/ProductCard'
import { getUserProducts, SupabaseProduct, deleteUserProduct } from '@/lib/supabase/products'
import { getProfile, ensureProfile, Profile } from '@/lib/supabase/profile'
import LavenderLoader from '@/components/ui/LavenderLoader'
import SkeletonDashboard from '@/components/ui/SkeletonDashboard'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'
import { Layers, LayoutGrid, Sparkles, Loader2, Clock, Plus, X, Pin } from 'lucide-react'
import Link from 'next/link'
import QueuedItemCard from '@/components/dashboard/QueuedItemCard'
import ImportModal from '@/components/dashboard/ImportModal'
import AddItemForm from '@/components/dashboard/AddItemForm'
import PageTransition from '@/components/ui/PageTransition'
import { useTranslation } from '@/lib/i18n/context'
import { updateProfile } from '@/lib/supabase/profile'

function getColCount(w: number) {
  if (w < 640) return 2
  if (w < 1024) return 2
  if (w < 1280) return 3
  return 4
}

function RoundRobinGrid({ items, renderItem }: { items: any[]; renderItem: (item: any, index: number) => React.ReactNode }) {
  const [colCount, setColCount] = useState(() => {
    if (typeof window === 'undefined') return 4
    return getColCount(window.innerWidth)
  })

  useEffect(() => {
    const onResize = () => setColCount(getColCount(window.innerWidth))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const columns = useMemo(() => {
    if (!items || items.length === 0) return []
    const cols: any[][] = Array.from({ length: colCount }, () => [])
    items.forEach((item, i) => {
      cols[i % colCount].push({ item, index: i })
    })
    return cols
  }, [items, colCount])

  if (!items || items.length === 0) return null

  return (
    <div className="flex gap-3 sm:gap-6">
      {columns.map((col, colIdx) => (
        <div key={colIdx} className="flex-1 space-y-3 sm:space-y-6">
          {col.map(({ item, index }) => (
            <div key={item.id}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [products, setProducts] = useState<SupabaseProduct[]>([])
  const [queuedItems, setQueuedItems] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoOrganizing, setAutoOrganizing] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showImportFromGrid, setShowImportFromGrid] = useState(false)
  const [showMobileAddForm, setShowMobileAddForm] = useState(false)
  const [autoOrganizeStats, setAutoOrganizeStats] = useState<{
    canAutoCategorize: number;
    uncategorized: number;
  } | null>(null)

  const { t } = useTranslation()

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
        
        // Load profile (auto-create if missing, e.g. profile row was deleted)
        let { data: profileData } = await getProfile(currentUser.id)
        if (!profileData) {
          const { data: created } = await ensureProfile(currentUser)
          profileData = created
        }
        if (profileData) {
          setProfile(profileData)
          if (profileData.onboarding_completed === false) {
            setShowOnboarding(true)
          }
        }
        
        // Load products
        const result = await getUserProducts(currentUser.id, currentUser.id)
        if (!result.error && result.data) {
          setProducts(result.data)
          setQueuedItems(result.queued || [])
          
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
        getUserProducts(session.user.id, session.user.id).then((result) => {
          if (!result.error && result.data) {
            setProducts(result.data)
            setQueuedItems(result.queued || [])
          }
        })
      } else {
        setUser(null)
        setProfile(null)
        setProducts([])
        setQueuedItems([])
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
            getUserProducts(user.id, user.id).then((result) => {
              if (!result.error && result.data) {
                setProducts(result.data)
                setQueuedItems(result.queued || [])
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

  // On-demand price check for paid users. Fires once per session when the
  // dashboard loads so Creator/Pro users get their tier-appropriate check
  // frequency even though the Vercel cron only runs once daily.
  useEffect(() => {
    const tier = profile?.subscription_tier
    if (!tier || tier === 'free') return
    const key = 'wist_user_price_check_ts'
    const last = Number(sessionStorage.getItem(key) || '0')
    const cooldownMs = (tier === 'creator' || tier === 'enterprise') ? 6 * 3600_000 : 12 * 3600_000
    if (Date.now() - last < cooldownMs) return
    sessionStorage.setItem(key, String(Date.now()))
    fetch('/api/cron/check-prices-user', { method: 'POST' }).catch(() => {})
  }, [profile?.subscription_tier])

  // Auto-scrape queued items when extension is available AND auto-activate is on.
  // The extension injects data-wist-installed asynchronously, so we poll for it
  // rather than doing a single synchronous check that loses the race on page load.
  const autoActivateEnabled = profile?.auto_activate_queued ?? true
  const [extensionReady, setExtensionReady] = useState(false)

  useEffect(() => {
    if (extensionReady) return
    const check = () => document.documentElement.getAttribute('data-wist-installed') === 'true'
    if (check()) { setExtensionReady(true); return }
    const iv = setInterval(() => { if (check()) { setExtensionReady(true); clearInterval(iv) } }, 400)
    const stop = setTimeout(() => clearInterval(iv), 6000)
    return () => { clearInterval(iv); clearTimeout(stop) }
  }, [extensionReady])

  useEffect(() => {
    if (queuedItems.length === 0) return
    if (!autoActivateEnabled) return
    if (!extensionReady) return

    let cancelled = false

    async function autoScrapeQueue() {
      console.log(`🔄 Auto-scraping ${queuedItems.length} queued items via extension...`)

      for (const item of queuedItems) {
        if (cancelled) break

        try {
          const result = await new Promise<any>((resolve) => {
            const messageId = `auto-scrape-${item.id}-${Date.now()}`

            const handleResponse = (event: MessageEvent) => {
              if (event.data?.type === 'WIST_SCRAPE_RESULT' && event.data?.messageId === messageId) {
                window.removeEventListener('message', handleResponse)
                resolve(event.data)
              }
            }

            window.addEventListener('message', handleResponse)
            window.postMessage({ type: 'WIST_SCRAPE_REQUEST', messageId, url: item.url }, '*')

            setTimeout(() => {
              window.removeEventListener('message', handleResponse)
              resolve(null)
            }, 20000)
          })

          if (cancelled) break

          if (result?.success && result?.data) {
            const scraped = result.data
            const hasGoodData = scraped.title && scraped.title.length > 5

            if (hasGoodData) {
              const { data: { session } } = await supabase.auth.getSession()
              await fetch('/api/items', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({
                  id: item.id,
                  title: scraped.title,
                  price: scraped.price || undefined,
                  image_url: scraped.image || scraped.image_url || undefined,
                  status: 'active',
                }),
              })
              console.log(`✅ Auto-scraped: ${scraped.title?.substring(0, 40)}`)
            }
          }
        } catch (err) {
          console.warn(`⚠️ Auto-scrape failed for ${item.url}:`, err)
        }
      }

      if (!cancelled) {
        fetchItems()
      }
    }

    const timer = setTimeout(autoScrapeQueue, 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [queuedItems.length > 0 ? 'has-items' : 'no-items', autoActivateEnabled, extensionReady])

  const handleHide = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId))
  }

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
    const result = await getUserProducts(user.id, user.id)
    if (!result.error && result.data) {
      setProducts(result.data)
      setQueuedItems(result.queued || [])
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
    return <SkeletonDashboard />
  }

  if (!user) {
    return null // Will redirect via useEffect
  }

  const adultFilterEnabled = profile?.adult_content_filter ?? true

  const handleQueuedUpdate = (id: string, updatedItem: any) => {
    setQueuedItems(prev => prev.filter(q => q.id !== id))
    if (updatedItem.status === 'active') {
      fetchItems()
    }
  }

  const handleQueuedDelete = (id: string) => {
    setQueuedItems(prev => prev.filter(q => q.id !== id))
  }

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    if (user) {
      const { data } = await getProfile(user.id)
      if (data) setProfile(data)
    }
  }

  const handlePinItem = async (itemId: string) => {
    if (!user) return
    const newPinnedId = (profile as any)?.pinned_item_id === itemId ? null : itemId
    try {
      const { data } = await updateProfile(user.id, { pinned_item_id: newPinnedId })
      if (data) setProfile(data)
    } catch (err) {
      console.error('Error pinning item:', err)
    }
  }

  const pinnedItemId = (profile as any)?.pinned_item_id || null
  const pinnedItem = pinnedItemId ? products.find(p => p.id === pinnedItemId) : null

  return (
    <PageTransition className="min-h-screen bg-beige-50 dark:bg-dpurple-950 pb-32 transition-colors">

      {/* Onboarding Tutorial */}
      {showOnboarding && user && (
        <OnboardingFlow userId={user.id} onComplete={handleOnboardingComplete} />
      )}

      {/* Extension Banner - High Visibility */}
      <ExtensionBanner />

      {/* Profile Header */}
      <ProfileHeader 
        user={user} 
        profile={profile}
        itemCount={products.length}
        totalValue={products.reduce((sum, p: any) => sum + (parseFloat(p.current_price || p.price) || 0), 0)}
        onRefreshPrices={handleRefreshPrices}
        refreshing={refreshing}
      />


      {/* Pinned "Most Wanted" Item */}
      {pinnedItem && (
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Pin className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Most Wanted</span>
          </div>
          <Link href={`/dashboard/item/${pinnedItem.id}`} className="block">
            <div className="flex items-center gap-4 p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl hover:shadow-md transition-all">
              {(pinnedItem as any).image || (pinnedItem as any).image_url ? (
                <img
                  src={(pinnedItem as any).image || (pinnedItem as any).image_url}
                  alt={pinnedItem.title || ''}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-amber-200 dark:border-amber-800/40"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-lg font-bold text-amber-400">{(pinnedItem.title || '?')[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">{pinnedItem.title}</h3>
                {(pinnedItem as any).current_price && (
                  <p className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    ${parseFloat((pinnedItem as any).current_price).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* The Content Grid */}
      <main className="relative z-0 isolate px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Queued Items Banner */}
        {queuedItems.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Queue ({queuedItems.length})
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {autoActivateEnabled
                  ? 'Items auto-activate on desktop with the extension'
                  : 'Press Activate on each item to scrape and add it'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {queuedItems.map((item: any) => (
                <QueuedItemCard
                  key={item.id}
                  item={item}
                  onUpdate={handleQueuedUpdate}
                  onDelete={handleQueuedDelete}
                  amazonTag={profile?.amazon_affiliate_id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Timeline View (Pinterest Grid) */}
        {viewMode === 'timeline' && (
          <WishlistGrid 
            items={products}
            isOwner={true}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onHide={handleHide}
            onPinItem={handlePinItem}
            pinnedItemId={pinnedItemId}
            userCollections={collections}
            adultFilterEnabled={adultFilterEnabled}
            tier={profile?.subscription_tier}
            amazonTag={profile?.amazon_affiliate_id}
            onImport={() => setShowImportFromGrid(true)}
          />
        )}

        {/* Categories View (Grouped by Collection) */}
        {viewMode === 'grouped' && (
          <div className="space-y-12">
            {/* Auto-organize Banner - Stacks on mobile */}
            {autoOrganizeStats && autoOrganizeStats.canAutoCategorize > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border border-violet-200 dark:border-violet-800 rounded-xl px-4 sm:px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {autoOrganizeStats.canAutoCategorize} item{autoOrganizeStats.canAutoCategorize !== 1 ? 's' : ''} can be auto-organized
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                      {t('Organizing...')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {t('Auto-organize')}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Show all items if no collections exist */}
            {collections.length === 0 && products.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  {t('All Items')}
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-dpurple-800 px-2 py-1 rounded-full">
                    {products.length}
                  </span>
                </h2>
                <RoundRobinGrid items={products} renderItem={(item: any, i: number) => (
                  <ProductCard 
                    item={item}
                    index={i}
                    userCollections={collections} 
                    onDelete={handleDelete}
                    onHide={handleHide}
                    onPinItem={handlePinItem}
                    pinnedItemId={pinnedItemId}
                    adultFilterEnabled={adultFilterEnabled}
                    tier={profile?.subscription_tier}
                    amazonTag={profile?.amazon_affiliate_id}
                  />
                )} />
              </section>
            )}

            {/* Uncategorized Section */}
            {collections.length > 0 && uncategorizedItems.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2 opacity-50">
                  <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-dpurple-500"></span>
                  {t('Uncategorized')}
                </h2>
                <RoundRobinGrid items={uncategorizedItems} renderItem={(item: any, i: number) => (
                  <ProductCard 
                    item={item}
                    index={i}
                    userCollections={collections} 
                    onDelete={handleDelete}
                    onHide={handleHide}
                    onPinItem={handlePinItem}
                    pinnedItemId={pinnedItemId}
                    adultFilterEnabled={adultFilterEnabled}
                    tier={profile?.subscription_tier}
                    amazonTag={profile?.amazon_affiliate_id}
                  />
                )} />
              </section>
            )}

            {/* Collection Sections */}
            {collections.length > 0 && groupedItems.map(group => (
              group.items.length > 0 && (
                <section key={group.id} className="pt-8 border-t border-zinc-200 dark:border-dpurple-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      {group.name}
                      <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-dpurple-800 px-2 py-1 rounded-full">
                        {group.items.length}
                      </span>
                    </h2>
                    <Link 
                      href={`/dashboard/collection/${group.slug}`} 
                      className="text-sm text-violet-600 hover:text-violet-700 hover:underline transition-colors"
                    >
                      {t('View Page →')}
                    </Link>
                  </div>
                  
                  <RoundRobinGrid items={group.items} renderItem={(item: any, i: number) => (
                    <ProductCard 
                      item={item}
                      index={i}
                      userCollections={collections} 
                      onDelete={handleDelete}
                      onHide={handleHide}
                      onPinItem={handlePinItem}
                      pinnedItemId={pinnedItemId}
                      adultFilterEnabled={adultFilterEnabled}
                      tier={profile?.subscription_tier}
                      amazonTag={profile?.amazon_affiliate_id}
                    />
                  )} />
                </section>
              )
            ))}

            {/* Empty State for Grouped View */}
            {products.length === 0 && (
              <>
                <div className="text-center py-20 text-zinc-500 dark:text-zinc-400">
                  {t('No items found. Add some items to see them here!')}
                </div>
              </>
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

      <ImportModal
        isOpen={showImportFromGrid}
        onClose={() => setShowImportFromGrid(false)}
        onComplete={() => {
          setShowImportFromGrid(false)
          window.location.reload()
        }}
      />

      {/* Mobile Floating Add Button */}
      <button
        onClick={() => setShowMobileAddForm(true)}
        className="md:hidden fixed bottom-24 right-5 z-[60] w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95"
        aria-label="Add item"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Mobile Add Form Modal */}
      {showMobileAddForm && (
        <div className="md:hidden fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileAddForm(false)} />
          <div className="relative w-full max-w-lg bg-beige-50 dark:bg-dpurple-950 rounded-t-2xl p-4 pb-8 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Item</h3>
              <button onClick={() => setShowMobileAddForm(false)} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <AddItemForm />
          </div>
        </div>
      )}
    </PageTransition>
  )
}