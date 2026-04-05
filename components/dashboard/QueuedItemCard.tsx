'use client'

import { useState, useEffect } from 'react'
import { Clock, Edit2, Trash2, Check, X, ExternalLink, CircleCheck, Loader2, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { affiliateUrl } from '@/lib/amazon-affiliate'
import { useTranslation } from '@/lib/i18n/context'
import { cleanPrice, priceFromScrapeValue } from '@/lib/scraper/utils'

function isActivatableProductUrl(url: string | null | undefined): boolean {
  const u = (url || '').trim()
  if (!u) return false
  try {
    const parsed = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || ''
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768
      setIsMobile(mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

interface QueuedItem {
  id: string
  url: string
  title: string | null
  image: string | null
  price: number | null
  created_at: string
  domain?: string | null
}

interface Props {
  item: QueuedItem
  onUpdate: (id: string, data: any) => void
  onDelete: (id: string) => void
  amazonTag?: string | null
}

export default function QueuedItemCard({ item, onUpdate, onDelete, amazonTag }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title || '')
  const [editPrice, setEditPrice] = useState(item.price ? item.price.toString() : '')
  const [editUrl, setEditUrl] = useState(item.url || '')
  const [isActivating, setIsActivating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setEditTitle(item.title || '')
    setEditPrice(item.price != null ? item.price.toString() : '')
    setEditUrl(item.url || '')
  }, [item.id, item.title, item.price, item.url])

  const domain = (() => {
    try {
      return new URL(item.url).hostname.replace('www.', '')
    } catch {
      return ''
    }
  })()

  const shortUrl = (() => {
    try {
      const u = new URL(item.url)
      const path = u.pathname.length > 30 ? u.pathname.substring(0, 30) + '...' : u.pathname
      return u.hostname.replace('www.', '') + path
    } catch {
      return item.url.substring(0, 50)
    }
  })()

  const timeAgo = (() => {
    const diff = Date.now() - new Date(item.created_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return t('{n}m ago', { n: String(Math.max(0, mins)) })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('{n}h ago', { n: String(hours) })
    const days = Math.floor(hours / 24)
    return t('{n}d ago', { n: String(days) })
  })()

  async function handleActivate() {
    if (!isActivatableProductUrl(item.url)) {
      window.alert(
        t(
          'This item has no valid product link. Use Edit to paste the full product URL, then try Activate again.'
        )
      )
      return
    }
    setIsActivating(true)
    try {
      const extensionInstalled = document.documentElement.getAttribute('data-wist-installed') === 'true'

      let scraped: any = null
      if (extensionInstalled) {
        scraped = await new Promise<any>((resolve) => {
          const messageId = `activate-${item.id}-${Date.now()}`
          const handleResponse = (event: MessageEvent) => {
            if (event.data?.type === 'WIST_SCRAPE_RESULT' && event.data?.messageId === messageId) {
              window.removeEventListener('message', handleResponse)
              resolve(event.data?.success ? event.data.data : null)
            }
          }
          window.addEventListener('message', handleResponse)
          window.postMessage({ type: 'WIST_SCRAPE_REQUEST', messageId, url: item.url }, '*')
          setTimeout(() => {
            window.removeEventListener('message', handleResponse)
            resolve(null)
          }, 25000)
        })
      }

      const { data: { session } } = await supabase.auth.getSession()
      let clientTier: string | undefined
      if (session?.user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', session.user.id)
          .single()
        clientTier = prof?.subscription_tier || undefined
      }
      const parsedScrape = priceFromScrapeValue(scraped?.original_price_raw ?? scraped?.price)
      const patchPrice = parsedScrape

      const res = await fetch('/api/items', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          id: item.id,
          title: scraped?.title || item.title,
          price: patchPrice,
          image_url: scraped?.image || scraped?.image_url || undefined,
          status: 'active',
          out_of_stock: scraped?.out_of_stock === true,
          client_tier: clientTier,
        }),
      })
      let result: { success?: boolean; item?: any; error?: string } = {}
      try {
        result = await res.json()
      } catch {
        result = {}
      }
      if (res.ok && result.success) {
        const row = result.item
        onUpdate(item.id, { ...row, status: (row?.status as string) || 'active' })
      } else {
        const msg =
          result.error ||
          (res.status === 403
            ? t('Item limit reached. Upgrade your plan or remove items to activate more.')
            : t('Could not activate this item. Try again or edit the product link.'))
        window.alert(msg)
      }
    } catch (err) {
      console.error('Activate failed:', err)
    } finally {
      setIsActivating(false)
    }
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) return
    setIsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const payload: Record<string, unknown> = {
        id: item.id,
        title: editTitle.trim(),
        price:
          editPrice.trim() !== ''
            ? (cleanPrice(editPrice.trim()) ?? undefined)
            : undefined,
      }
      const trimmedUrl = editUrl.trim()
      if (trimmedUrl) payload.url = trimmedUrl
      const res = await fetch('/api/items', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      let result: { success?: boolean; item?: any; error?: string } = {}
      try {
        result = await res.json()
      } catch {
        result = {}
      }
      if (res.ok && result.success) {
        onUpdate(item.id, result.item)
        setIsEditing(false)
      } else if (result.error) {
        window.alert(result.error)
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`/api/delete-item?id=${item.id}`, {
        method: 'DELETE',
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
      })
      onDelete(item.id)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  if (isEditing) {
    return (
      <div className="bg-beige-100 border-2 border-dashed border-violet-300 rounded-xl p-4 space-y-3">
        <p className="text-xs text-violet-600 font-medium">{t('Fill in details manually')}</p>
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder={t('Product name')}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
          autoFocus
        />
        <input
          type="text"
          value={editPrice}
          onChange={(e) => setEditPrice(e.target.value)}
          placeholder={t('Price placeholder example')}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
        />
        <input
          type="url"
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          placeholder={t('Product page URL (https://…)')}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveEdit}
            disabled={isSaving || !editTitle.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {t('Save')}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-2 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-beige-100 dark:bg-dpurple-900 border-2 border-dashed border-zinc-200 dark:border-dpurple-600 rounded-xl p-3 sm:p-4 hover:border-violet-300 dark:hover:border-violet-700 transition-colors group">
      <div className="flex items-start gap-3">
        {/* Favicon */}
        <div className="flex-shrink-0 w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center overflow-hidden">
          {domain ? (
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt={domain}
              className="w-5 h-5"
              loading="lazy"
            />
          ) : (
            <Clock className="w-4 h-4 text-zinc-400" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
              <Clock className="w-2.5 h-2.5" />
              {t('Queued')}
            </span>
            <span className="text-[10px] text-zinc-400">{timeAgo}</span>
          </div>

          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {item.title && item.title !== 'New Item' ? item.title : shortUrl}
          </p>

          {item.title && item.title !== 'New Item' && (
            <p className="text-[10px] text-zinc-400 truncate mt-0.5">{shortUrl}</p>
          )}
        </div>

        {/* External link */}
        {item.url?.trim() ? (
          <a
            href={affiliateUrl(item.url, amazonTag)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 text-zinc-400 hover:text-violet-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <span
            className="flex-shrink-0 p-1.5 text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
            title={t('No product link')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {/* Actions */}
      {isMobile ? (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-400 flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            {t('Open on PC to activate')}
          </p>
          <button
            onClick={handleDelete}
            className="px-2.5 py-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {!isActivatableProductUrl(item.url) && (
            <p className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-2 py-1.5">
              {t('No valid product link. Edit and paste the full https URL from the store, then Activate.')}
            </p>
          )}
          <div className="flex gap-2">
          <button
            onClick={handleActivate}
            disabled={isActivating || !isActivatableProductUrl(item.url)}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-violet-50 text-violet-700 text-xs font-medium rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
          >
            {isActivating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CircleCheck className="w-3 h-3" />}
            {isActivating ? t('Scraping...') : t('Activate')}
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-zinc-50 text-zinc-700 text-xs font-medium rounded-lg hover:bg-zinc-100 transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            {t('Edit')}
          </button>
          <button
            onClick={handleDelete}
            className="px-2.5 py-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          </div>
        </div>
      )}
    </div>
  )
}
