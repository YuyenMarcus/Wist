'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getProfile } from '@/lib/supabase/profile'
import { Loader2 } from 'lucide-react'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [badgeUsers, setBadgeUsers] = useState<number | undefined>()
  const [badgeBanned, setBadgeBanned] = useState<number | undefined>()

  useEffect(() => {
    fetch('/api/admin/sidebar-counts', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.signups24h === 'number' && d.signups24h > 0) setBadgeUsers(d.signups24h)
        if (typeof d.banned === 'number' && d.banned > 0) setBadgeBanned(d.banned)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function gate() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: profile } = await getProfile(user.id)
      if (!profile?.is_admin) {
        router.replace('/dashboard')
        return
      }
      setAuthorized(true)
      setLoading(false)
    }
    gate()
  }, [router])

  const onGlobalSearchSubmit = useCallback(() => {
    const q = globalSearch.trim()
    if (!q) {
      router.push('/admin/users')
      return
    }
    router.push(`/admin/users?q=${encodeURIComponent(q)}`)
    setMobileNav(false)
  }, [globalSearch, router])

  useEffect(() => {
    setMobileNav(false)
  }, [pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen flex bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AdminSidebar
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
        badgeUsers={badgeUsers}
        badgeBanned={badgeBanned}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <AdminTopBar
          onMenuClick={() => setMobileNav(true)}
          globalSearchQuery={globalSearch}
          onGlobalSearchChange={setGlobalSearch}
          onGlobalSearchSubmit={onGlobalSearchSubmit}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
