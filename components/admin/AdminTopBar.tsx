'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Bell, User } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { AdminMobileMenuButton } from './AdminSidebar'
import { AdminNotificationPanel, type AdminNotification } from './AdminNotificationPanel'

export function AdminTopBar({
  onMenuClick,
  globalSearchQuery,
  onGlobalSearchChange,
  onGlobalSearchSubmit,
}: {
  onMenuClick: () => void
  globalSearchQuery: string
  onGlobalSearchChange: (q: string) => void
  onGlobalSearchSubmit: () => void
}) {
  const router = useRouter()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])

  const loadMe = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? null)
    const meta = user.user_metadata as { avatar_url?: string } | undefined
    setAvatarUrl(meta?.avatar_url ?? null)
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    fetch('/api/admin/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.notifications)) setNotifications(d.notifications)
      })
      .catch(() => setNotifications([]))
  }, [])

  const unread = notifications.length > 0 ? Math.min(notifications.length, 9) : 0

  return (
    <header className="sticky top-0 z-50 h-14 flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-900/80">
      <div className="flex h-full items-center gap-3 px-4 lg:px-6">
        <AdminMobileMenuButton onClick={onMenuClick} />

        <Link
          href="/admin"
          className="hidden sm:flex items-center gap-2 min-w-0 shrink-0 rounded-lg hover:opacity-90"
          title="Admin home"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-600 items-center justify-center flex">
            <span className="text-white text-xs font-bold">W</span>
          </div>
          <span className="hidden md:inline text-sm font-bold text-zinc-900 dark:text-zinc-100">Wist</span>
        </Link>

        <form
          className="flex-1 max-w-xl min-w-0"
          onSubmit={(e) => {
            e.preventDefault()
            onGlobalSearchSubmit()
          }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="search"
              value={globalSearchQuery}
              onChange={(e) => onGlobalSearchChange(e.target.value)}
              placeholder="Search users…"
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900 focus:border-violet-400 outline-none"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <AdminNotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} notifications={notifications} />
          </div>

          <button
            type="button"
            onClick={() => router.push('/account')}
            className="flex items-center gap-2 p-1.5 pr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Account"
          >
            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-8 h-8 object-cover" />
              ) : (
                <User className="w-4 h-4 text-violet-600" />
              )}
            </div>
            <span className="hidden md:block text-xs text-zinc-600 dark:text-zinc-300 max-w-[140px] truncate">{email || 'Admin'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
