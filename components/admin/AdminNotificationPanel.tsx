'use client'

import Link from 'next/link'
import { X, UserPlus, CreditCard, Flag, Package } from 'lucide-react'

export type AdminNotification = {
  id: string
  title: string
  description: string
  time: string
  href?: string
  icon: 'user' | 'payment' | 'flag' | 'order'
}

const ICONS = {
  user: UserPlus,
  payment: CreditCard,
  flag: Flag,
  order: Package,
}

/** Demo events until a real admin notification feed exists */
export const DEMO_ADMIN_NOTIFICATIONS: AdminNotification[] = [
  {
    id: '1',
    title: 'New signup spike',
    description: 'User registrations are up compared to the prior 30 days — check KPIs.',
    time: 'Just now',
    href: '/admin',
    icon: 'user',
  },
  {
    id: '2',
    title: 'Review banned list',
    description: 'Ensure banned emails align with your moderation policy.',
    time: 'Today',
    href: '/admin/banned',
    icon: 'flag',
  },
  {
    id: '3',
    title: 'Paid members',
    description: 'See tier breakdown in Overview charts.',
    time: 'This week',
    href: '/admin',
    icon: 'payment',
  },
]

export function AdminNotificationPanel({
  open,
  onClose,
  notifications,
}: {
  open: boolean
  onClose: () => void
  notifications: AdminNotification[]
}) {
  if (!open) return null

  return (
    <>
      <button type="button" className="fixed inset-0 z-[80] bg-black/20" aria-label="Close notifications" onClick={onClose} />
      <div className="fixed right-4 top-14 z-[90] w-[min(100vw-2rem,380px)] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</p>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
        <ul className="max-h-[min(70vh,420px)] overflow-y-auto">
          {notifications.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">No system events yet</li>
          ) : (
            notifications.map((n) => {
              const Icon = ICONS[n.icon]
              const inner = (
                <div className="flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{n.description}</p>
                    <p className="text-[10px] text-zinc-400 mt-1.5 uppercase tracking-wide">{n.time}</p>
                  </div>
                </div>
              )
              return (
                <li key={n.id} className="border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                  {n.href ? (
                    <Link href={n.href} onClick={onClose} className="block">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              )
            })
          )}
        </ul>
      </div>
    </>
  )
}
