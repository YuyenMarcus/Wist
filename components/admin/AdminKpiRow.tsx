'use client'

import { TrendingUp, TrendingDown, Users, Package, Ban, Gem } from 'lucide-react'

function Delta({ value, label }: { value: number; label?: string }) {
  const pos = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {pos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {pos ? '+' : ''}
      {value}% {label ?? 'vs prior 30 days'}
    </span>
  )
}

export function AdminKpiRow({
  totalUsers,
  newUsers30,
  signupDeltaPct,
  activeItems,
  bannedCount,
  paidMembers,
  itemsDeltaPct,
  itemsNew30,
  bannedDeltaPct,
  paidSharePct,
}: {
  totalUsers: number
  newUsers30: number
  signupDeltaPct: number
  activeItems: number
  bannedCount: number
  paidMembers: number
  itemsDeltaPct: number
  itemsNew30: number
  bannedDeltaPct: number
  paidSharePct: number
}) {
  const cards = [
    {
      label: 'Total users',
      value: totalUsers.toLocaleString(),
      sub: <Delta value={signupDeltaPct} />,
      icon: Users,
      foot: `${newUsers30.toLocaleString()} new (30d)`,
    },
    {
      label: 'Active items',
      value: activeItems.toLocaleString(),
      sub: <Delta value={itemsDeltaPct} />,
      icon: Package,
      foot: `${itemsNew30.toLocaleString()} new items (30d)`,
    },
    {
      label: 'Paid members',
      value: paidMembers.toLocaleString(),
      sub: <span className="text-xs text-zinc-500">{paidSharePct}% of all users</span>,
      icon: Gem,
      foot: 'Pro, Creator, Enterprise',
    },
    {
      label: 'Banned emails',
      value: bannedCount.toLocaleString(),
      sub: <Delta value={bannedDeltaPct} label="new entries (30d vs prior)" />,
      icon: Ban,
      foot: 'Blocklist size',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{c.label}</p>
              <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/40">
                <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{c.value}</p>
            <div className="mt-2">{c.sub}</div>
            {c.foot && <p className="mt-2 text-xs text-zinc-400">{c.foot}</p>}
          </div>
        )
      })}
    </div>
  )
}
