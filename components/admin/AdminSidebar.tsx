'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Ban,
  Settings,
  Shield,
  ScrollText,
  Menu,
  X,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  badge?: number
}

const MAIN: NavItem[] = [{ href: '/admin', label: 'Overview', icon: LayoutDashboard }]

function managementNav(badges: { users?: number; banned?: number }): NavItem[] {
  return [
    { href: '/admin/users', label: 'Users', icon: Users, badge: badges.users },
    { href: '/admin/banned', label: 'Banned emails', icon: Ban, badge: badges.banned },
  ]
}

const SYSTEM: NavItem[] = [
  { href: '/admin/roles', label: 'Roles & permissions', icon: Shield },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <div className="mb-6">
      <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{title}</p>
      <nav className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-violet-600/15 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/50'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-violet-600 dark:text-violet-400' : ''}`} />
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function AdminSidebar({
  mobileOpen,
  onCloseMobile,
  badgeUsers,
  badgeBanned,
}: {
  mobileOpen: boolean
  onCloseMobile: () => void
  badgeUsers?: number
  badgeBanned?: number
}) {
  const aside = (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-zinc-200 dark:border-zinc-800 lg:border-0">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">Wist Admin</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Console</p>
        </div>
        <button
          type="button"
          className="lg:hidden ml-auto p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800"
          onClick={onCloseMobile}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavSection title="Main" items={MAIN} />
        <NavSection title="Management" items={managementNav({ users: badgeUsers, banned: badgeBanned })} />
        <NavSection title="System" items={SYSTEM} />
      </div>
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <Link
          href="/dashboard"
          className="block text-center text-xs font-medium text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 py-2"
        >
          ← Back to app
        </Link>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden lg:flex lg:flex-shrink-0">{aside}</div>
      {mobileOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[70] bg-black/40 lg:hidden" aria-label="Close menu" onClick={onCloseMobile} />
          <div className="fixed inset-y-0 left-0 z-[80] w-64 shadow-xl lg:hidden animate-in slide-in-from-left duration-200">{aside}</div>
        </>
      )}
    </>
  )
}

export function AdminMobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
      aria-label="Open menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}
