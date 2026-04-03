'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Filter,
  Download,
  Plus,
  User,
  Check,
  Ban,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
} from 'lucide-react'
import { AdminKpiRow } from '@/components/admin/AdminKpiRow'
import { AdminChartsSection } from '@/components/admin/AdminChartsSection'
import type { AdminUser } from '@/components/admin/types'
import { formatAdminDate } from '@/components/admin/utils'
import { TIERS, type SubscriptionTier } from '@/lib/constants/subscription-tiers'

const TIER_BADGE_STYLES: Record<string, string> = {
  free: 'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600',
  pro: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  creator: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
}

type StatsPayload = {
  kpis: {
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
  }
  weeklySignups: { week: string; signups: number }[]
  tierBreakdown: { name: string; value: number }[]
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)
  const [recent, setRecent] = useState<AdminUser[]>([])
  const [tableLoading, setTableLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const LIMIT = 8

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setStatsErr(d.error)
        else setStats(d)
      })
      .catch(() => setStatsErr('Failed to load stats'))
  }, [])

  const fetchRecent = useCallback(async () => {
    setTableLoading(true)
    try {
      const params = new URLSearchParams({ q: '', page: String(page), limit: String(LIMIT) })
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (data.users) {
        setRecent(data.users)
        setTotal(data.total)
      }
    } finally {
      setTableLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchRecent()
  }, [fetchRecent])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function exportRecentCsv() {
    const headers = ['Name', 'Email', 'Role', 'Plan', 'Status', 'Joined', 'Items', 'Last login']
    const lines = [headers.join(',')]
    for (const u of recent) {
      const role = u.is_admin ? 'Admin' : 'Member'
      const plan = TIERS[(u.subscription_tier || 'free') as SubscriptionTier]?.displayName || u.subscription_tier
      let status = 'Active'
      if (u.is_banned) status = 'Inactive'
      else if (!u.last_sign_in_at) status = 'Pending'
      const row = [
        `"${(u.full_name || u.username || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        role,
        `"${plan}"`,
        status,
        u.created_at || '',
        String(u.item_count ?? 0),
        u.last_sign_in_at || '',
      ]
      lines.push(row.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wist-users-page-${page + 1}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="p-4 lg:p-6 space-y-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Overview</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Health check across users, items, and moderation.</p>
      </div>

      {statsErr && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {statsErr}
        </div>
      )}

      {stats && (
        <AdminKpiRow
          totalUsers={stats.kpis.totalUsers}
          newUsers30={stats.kpis.newUsers30}
          signupDeltaPct={stats.kpis.signupDeltaPct}
          activeItems={stats.kpis.activeItems}
          bannedCount={stats.kpis.bannedCount}
          paidMembers={stats.kpis.paidMembers}
          itemsDeltaPct={stats.kpis.itemsDeltaPct ?? 0}
          itemsNew30={stats.kpis.itemsNew30 ?? 0}
          bannedDeltaPct={stats.kpis.bannedDeltaPct ?? 0}
          paidSharePct={stats.kpis.paidSharePct ?? 0}
        />
      )}

      {stats && <AdminChartsSection weeklySignups={stats.weeklySignups} tierBreakdown={stats.tierBreakdown} />}

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent users</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Filter className="w-3.5 h-3.5" /> Full list
            </Link>
            <button
              type="button"
              onClick={exportRecentCsv}
              disabled={recent.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700"
            >
              <Plus className="w-3.5 h-3.5" /> Manage users
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[820px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">User</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Role / plan</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Last login</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Joined</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 w-12" />
              </tr>
            </thead>
            <tbody>
              {tableLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    <Loader2 className="w-6 h-6 animate-spin inline text-violet-500" />
                  </td>
                </tr>
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No users
                  </td>
                </tr>
              ) : (
                recent.map((u) => {
                  const tierKey = u.subscription_tier || 'free'
                  const tierConfig = TIERS[tierKey as SubscriptionTier]
                  const role = u.is_admin ? 'Admin' : 'Member'
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-zinc-50 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-9 h-9 object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-violet-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {u.full_name || u.username || '—'}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {role}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TIER_BADGE_STYLES[tierKey] || TIER_BADGE_STYLES.free}`}
                          >
                            {tierConfig?.displayName || tierKey}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_banned ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-full border border-red-200 dark:border-red-900">
                            <Ban className="w-3 h-3" /> Inactive
                          </span>
                        ) : !u.last_sign_in_at ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-full border border-amber-200 dark:border-amber-900">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {u.last_sign_in_at ? formatAdminDate(u.last_sign_in_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        {formatAdminDate(u.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users?focus=${u.id}`}
                          className="p-2 inline-flex rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700"
                          title="Open in Users"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
            <p className="text-xs text-zinc-500">
              Page {page + 1} of {totalPages} · {total} users
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
