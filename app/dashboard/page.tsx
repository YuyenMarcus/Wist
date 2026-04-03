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
import { Layers, LayoutGrid, Sparkles, Loader2, Clock, Plus, X, Pin, Trash2 } from 'lucide-react'
import Link from 'next/link'
import QueuedItemCard from '@/components/dashboard/QueuedItemCard'
import { useDashboardImportModal } from '@/components/dashboard/ImportModalProvider'
import AddItemForm from '@/components/dashboard/AddItemForm'
import PageTransition from '@/components/ui/PageTransition'
import { useTranslation } from '@/lib/i18n/context'
import { updateProfile } from '@/lib/supabase/profile'
import { effectiveAmazonAffiliateId } from '@/lib/amazon-affiliate'

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
  const [autoOrganizing, setAutoOrganizing] = useState(false)
  const [clearingQueue, setClearingQueue] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { openImport } = useDashboardImportModal()
  const [showMobileAddForm, setShowMobileAddForm] = useState(false)
  const [autoOrganizeStats, setAutoOrganizeStats] = useState<{
    canAutoCategorize: number;
    uncategorized: number;
  } | null>(null)

  const { t } = useTranslation()

  // Determine view mode from URL parameter
  const viewMode = searchParams?.get('view') === 'grouped' ? 'grouped' : 'timeline'

  const collectionIdSet = useMemo(
    () => new Set(collections.map((c: any) => c.id?.toString()).filter(Boolean)),
    [collections]
  )

  // Group items by collection for the Collections view - use useMemo to ensure proper computation
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
      const cid =
        item.collection_id !== null && item.collection_id !== undefined && item.collection_id !== ''
          ? String(item.collection_id)
          : null
      if (!cid) return true
      // Orphaned: collection_id points to a list we didn't load (deleted, RLS, etc.) — still show the item
      if (!collectionIdSet.has(cid)) return true
      return false
    })
    
    // Debug logging
    if (viewMode === 'grouped') {
      console.log('📦 Uncategorized items:', {
        count: uncategorized.length,
        items: uncategorized.map((i: any) => ({ id: i.id, title: i.title, collection_id: i.collection_id }))
      })
    }
    
    return uncategorized
  }, [products, viewMode, collectionIdSet])

  const amazonAffiliateTag = useMemo(
    () => effectiveAmazonAffiliateId(profile?.subscription_tier, profile?.amazon_affiliate_id),
    [profile?.subscription_tier, profile?.amazon_affiliate_id],
  )

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
            const title =
              scraped.title && String(scraped.title).trim().length > 0
                ? scraped.title
                : item.title && item.title !== 'New Item'
                  ? item.title
                  : 'Untitled Item'
            let patchPrice: number | string | undefined
            const raw = scraped.original_price_raw ?? scraped.price
            if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
              patchPrice = raw
            } else if (raw != null && raw !== '') {
              const cleaned = String(raw).replace(/[^0-9.]/g, '')
              const n = parseFloat(cleaned)
              if (Number.isFinite(n) && n > 0) patchPrice = cleaned
            }
            const { data: { session } } = await supabase.auth.getSession()
            await fetch('/api/items', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
              },
              body: JSON.stringify({
                id: item.id,
                title,
                price: patchPrice,
                image_url: scraped.image || scraped.image_url || undefined,
                status: 'active',
                out_of_stock: scraped.out_of_stock === true,
                client_tier: profile?.subscription_tier || undefined,
              }),
            })
            console.log(`✅ Auto-scraped: ${String(title).substring(0, 40)}`)
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

    setProducts((prev) => prev.filter((p) => p.id !== productId))

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        alert('Please log in again.')
        await fetchItems()
        return
      }

      const res = await fetch(`/api/delete-item?id=${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        console.error('Delete failed:', data)
        throw new Error(data.message || 'Failed to delete')
      }
      // Do not refetch the full list here — that was causing a 1s+ re-render of the
      // entire dashboard. Optimistic state already matches the server.
    } catch (error: unknown) {
      console.error(error)
      alert('Could not delete item. Restoring your list…')
      await fetchItems()
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
    // Use length (not full `products`) so reflows like title edits don’t hit the API; deletes/hides still update length.
  }, [viewMode, user, products.length])

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

  const handleQueuedUpdate = async (id: string, updatedItem: any) => {
    const activated =
      updatedItem?.status === 'active' ||
      (updatedItem && String(updatedItem.status || '').toLowerCase() === 'active')
    if (activated) {
      setQueuedItems(prev => prev.filter(q => q.id !== id))
    }
    await fetchItems()
  }

  const handleQueuedDelete = (id: string) => {
    setQueuedItems(prev => prev.filter(q => q.id !== id))
  }

  const handleDeleteAllQueued = async () => {
    if (!user || queuedItems.length === 0) return
    const n = queuedItems.length
    const confirmMsg =
      n === 1
        ? t('Delete the item in your queue? This cannot be undone.')
        : t('Delete all {n} items in your queue? This cannot be undone.', { n: String(n) })
    if (!confirm(confirmMsg)) {
      return
    }
    setClearingQueue(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/items/queue', {
        method: 'DELETE',
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(typeof payload.error === 'string' ? payload.error : t('Could not clear queue.'))
        return
      }
      setQueuedItems([])
    } catch (e) {
      console.error('Clear queue failed:', e)
      alert(t('Could not clear queue.'))
    } finally {
      setClearingQueue(false)
    }
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('Queue ({n})', { n: String(queuedItems.length) })}
                </h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {autoActivateEnabled
                    ? t('Items auto-activate on desktop with the extension')
                    : t('Press Activate on each item to scrape and add it')}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDeleteAllQueued}
                disabled={clearingQueue}
                className="shrink-0 self-end sm:self-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/70 disabled:opacity-50 transition-colors"
              >
                {clearingQueue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {t('Delete all')}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {queuedItems.map((item: any) => (
                <QueuedItemCard
                  key={item.id}
                  item={item}
                  onUpdate={handleQueuedUpdate}
                  onDelete={handleQueuedDelete}
                  amazonTag={amazonAffiliateTag}
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
            amazonTag={amazonAffiliateTag}
            onImport={() => openImport()}
          />
        )}

        {/* Collections view (grouped by list) */}
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
                    amazonTag={amazonAffiliateTag}
                  />
                )} />
              </section>
            )}

            {/* Items not in any list */}
            {collections.length > 0 && uncategorizedItems.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2 opacity-50">
                  <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-dpurple-500"></span>
                  {t('No collection')}
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
                    amazonTag={amazonAffiliateTag}
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
                      amazonTag={amazonAffiliateTag}
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