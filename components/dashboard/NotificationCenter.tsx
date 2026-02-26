'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, TrendingDown, TrendingUp, PackageCheck, Check, CheckCheck, ExternalLink } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

interface NotificationItem {
  id: string
  item_id: string
  notification_type: 'price_drop' | 'back_in_stock' | 'price_increase'
  old_price: number | null
  new_price: number | null
  price_change_percent: number | null
  read: boolean
  created_at: string
  items: {
    title: string | null
    image_url: string | null
    url: string | null
    retailer: string | null
  } | null
}

interface NotificationCenterProps {
  compact?: boolean
}

export default function NotificationCenter({ compact = false }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tier, setTier] = useState('free')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
      setTier(data.tier || 'free')
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {}
  }

  async function markRead(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  function getIcon(type: string) {
    switch (type) {
      case 'price_drop':
        return <TrendingDown className="w-4 h-4 text-green-500" />
      case 'back_in_stock':
        return <PackageCheck className="w-4 h-4 text-blue-500" />
      case 'price_increase':
        return <TrendingUp className="w-4 h-4 text-red-400" />
      default:
        return <Bell className="w-4 h-4 text-violet-500" />
    }
  }

  function getMessage(n: NotificationItem) {
    const item = Array.isArray(n.items) ? n.items[0] : n.items
    const title = item?.title || t('An item')
    const short = title.length > 40 ? title.substring(0, 40) + '...' : title

    switch (n.notification_type) {
      case 'price_drop': {
        const pct = Math.abs(n.price_change_percent || 0).toFixed(0)
        return (
          <>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{short}</span>{' '}
            {t('dropped')}{' '}
            <span className="font-bold text-green-600">{pct}%</span>
            {n.old_price && n.new_price ? (
              <span className="text-zinc-400 dark:text-zinc-500">
                {' '}(${n.old_price.toFixed(2)} → ${n.new_price.toFixed(2)})
              </span>
            ) : null}
          </>
        )
      }
      case 'back_in_stock':
        return (
          <>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{short}</span>{' '}
            is <span className="font-bold text-blue-600">{t('back in stock')}</span>
            {n.new_price ? (
              <span className="text-zinc-400 dark:text-zinc-500"> {t('at')} ${n.new_price.toFixed(2)}</span>
            ) : null}
          </>
        )
      case 'price_increase': {
        const pct = Math.abs(n.price_change_percent || 0).toFixed(0)
        return (
          <>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{short}</span>{' '}
            {t('went up')}{' '}
            <span className="font-bold text-red-500">{pct}%</span>
          </>
        )
      }
      default:
        return <span className="font-semibold text-zinc-900 dark:text-zinc-100">{short}</span>
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('Just now')
    if (mins < 60) return `${mins}${t('m ago')}`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}${t('h ago')}`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}${t('d ago')}`
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative rounded-full p-2.5 sm:p-3 shadow-sm border transition-all ${
          unreadCount > 0
            ? 'bg-beige-100 dark:bg-dpurple-900 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950'
            : 'bg-beige-100 dark:bg-dpurple-900 text-zinc-400 dark:text-zinc-500 border-beige-200 dark:border-dpurple-600 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-beige-50 dark:hover:bg-dpurple-800'
        }`}
        title={t('Notifications')}
      >
        <Bell size={compact ? 16 : 18} className="sm:w-5 sm:h-5" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-dpurple-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[340px] sm:w-[380px] bg-beige-50 dark:bg-dpurple-900 border border-beige-200 dark:border-dpurple-700 rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-dpurple-700">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t('Notifications')}</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {t('Mark all read')}
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{t('No notifications yet')}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-[200px] mx-auto">
                    {t("We'll notify you when prices drop on your items")}
                  </p>
                </div>
              ) : (
                notifications.map(n => {
                  const item = Array.isArray(n.items) ? n.items[0] : n.items
                  return (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 border-b border-zinc-50 dark:border-dpurple-800 hover:bg-zinc-50 dark:hover:bg-dpurple-800/50 transition-colors cursor-pointer ${
                        !n.read ? 'bg-violet-50/50 dark:bg-violet-950/20' : ''
                      }`}
                      onClick={() => {
                        if (!n.read) markRead(n.id)
                      }}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          n.notification_type === 'price_drop'
                            ? 'bg-green-100 dark:bg-green-950/40'
                            : n.notification_type === 'back_in_stock'
                            ? 'bg-blue-100 dark:bg-blue-950/40'
                            : 'bg-red-100 dark:bg-red-950/40'
                        }`}>
                          {getIcon(n.notification_type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          {getMessage(n)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{timeAgo(n.created_at)}</span>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                          )}
                        </div>
                      </div>

                      {/* Thumbnail */}
                      {item?.image_url && (
                        <div className="flex-shrink-0">
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-zinc-100 dark:bg-dpurple-800"
                          />
                        </div>
                      )}

                      {/* External link */}
                      {item?.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex-shrink-0 self-center text-zinc-300 dark:text-zinc-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {tier === 'free' && notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-dpurple-700 bg-zinc-50/50 dark:bg-dpurple-800/30">
                <Link
                  href="/#pricing"
                  className="text-[11px] text-center block text-violet-600 dark:text-violet-400 font-medium hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  {t('Upgrade to Wist+ for back-in-stock alerts →')}
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
