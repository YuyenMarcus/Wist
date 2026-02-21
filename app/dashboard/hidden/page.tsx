'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getProfile, Profile } from '@/lib/supabase/profile'
import LavenderLoader from '@/components/ui/LavenderLoader'
import { EyeOff, ArrowLeft, ExternalLink, Eye, Trash2, Calendar } from 'lucide-react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface HiddenItem {
  id: string
  title: string
  url: string
  current_price: number | null
  image_url: string | null
  retailer: string | null
  created_at: string
  updated_at?: string
}

export default function HiddenPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [items, setItems] = useState<HiddenItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        router.push('/login')
        return
      }
      
      setUser({ id: currentUser.id, email: currentUser.email })
      
      const { data: hiddenItems, error } = await supabase
        .from('items')
        .select('id, title, url, current_price, image_url, retailer, created_at, updated_at')
        .eq('user_id', currentUser.id)
        .eq('status', 'hidden')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching hidden items:', error)
      } else {
        setItems(hiddenItems || [])
      }
      
      setLoading(false)
    }
    
    loadData()
  }, [router])

  const handleUnhide = async (itemId: string) => {
    const { error } = await supabase
      .from('items')
      .update({ status: 'active' })
      .eq('id', itemId)
      .eq('user_id', user?.id)
    
    if (error) {
      console.error('Error unhiding item:', error)
      alert('Failed to unhide item: ' + error.message)
    } else {
      setItems(prev => prev.filter(item => item.id !== itemId))
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return
    
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user?.id)
    
    if (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete item: ' + error.message)
    } else {
      setItems(prev => prev.filter(item => item.id !== itemId))
    }
  }

  const formatPrice = (price: number | null): string => {
    if (!price || price === 0) return ''
    return `$${price.toFixed(2)}`
  }

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <LavenderLoader size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 pb-32">
      <div className="fixed inset-0 z-[-1] bg-grid-pattern opacity-30 pointer-events-none" />

      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard" 
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-600" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <EyeOff className="w-5 h-5 text-zinc-500" />
                  Hidden Items
                </h1>
                <p className="text-sm text-zinc-500">
                  {items.length} hidden item{items.length !== 1 ? 's' : ''} — these don't count toward your list total
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <EyeOff className="w-8 h-8 text-zinc-400" />
            </div>
            <h2 className="text-lg font-medium text-zinc-900 mb-2">No hidden items</h2>
            <p className="text-zinc-500 mb-6">
              Items you hide will appear here. They won't show on your list or profile.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Wishlist
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative bg-white rounded-xl overflow-hidden border border-zinc-200 hover:border-zinc-400 hover:shadow-lg transition-all duration-300"
                >
                  {/* Hidden Badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="inline-flex items-center gap-1 bg-zinc-700 text-white text-xs font-bold px-2 py-1 rounded-full">
                      <EyeOff className="w-3 h-3" />
                      Hidden
                    </span>
                  </div>

                  {/* Image */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover opacity-60"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100">
                        <span className="text-2xl font-medium text-zinc-400">
                          {item.title?.substring(0, 2).toUpperCase() || '??'}
                        </span>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={() => handleUnhide(item.id)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white text-zinc-600 hover:text-violet-600 transition-colors"
                        title="Unhide — move back to wishlist"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white text-zinc-600 hover:text-red-600 transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-medium text-zinc-900 text-sm mb-2 line-clamp-2">
                      {item.title || 'Untitled Item'}
                    </h3>
                    
                    <div className="flex items-center justify-between mb-3">
                      {item.current_price ? (
                        <span className="text-sm font-bold text-zinc-900">
                          {formatPrice(item.current_price)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">No price</span>
                      )}
                      
                      <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(item.updated_at || item.created_at)}
                      </span>
                    </div>
                    
                    {/* Unhide Button */}
                    <button
                      onClick={() => handleUnhide(item.id)}
                      className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 px-3 py-2 rounded-lg transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Unhide
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}
