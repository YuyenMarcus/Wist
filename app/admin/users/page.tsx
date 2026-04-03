'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  Users,
  User,
  Ban,
  Crown,
  Gem,
  Building2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarDays,
  MoreHorizontal,
  Clock,
  Download,
  Filter,
} from 'lucide-react'
import { TIERS, type SubscriptionTier } from '@/lib/constants/subscription-tiers'
import { EditUserModal } from '@/components/admin/EditUserModal'
import type { AdminUser } from '@/components/admin/types'
import { formatAdminDate } from '@/components/admin/utils'

const TIER_BADGE_STYLES: Record<string, string> = {
  free: 'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600',
  pro: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300',
  creator: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40',
  enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40',
}

const TIER_ICONS: Record<string, typeof User> = {
  free: User,
  pro: Gem,
  creator: Crown,
  enterprise: Building2,
}

const TIER_ICON_COLORS: Record<string, string> = {
  free: 'text-zinc-400',
  pro: 'text-violet-500',
  creator: 'text-amber-500',
  enterprise: 'text-emerald-500',
}

function TierIcon({ tier, className = 'w-3.5 h-3.5' }: { tier: string; className?: string }) {
  const Icon = TIER_ICONS[tier] || User
  return <Icon className={`${className} ${TIER_ICON_COLORS[tier] || 'text-zinc-400'}`} />
}

function UsersPageInner() {
  const searchParams = useSearchParams()
  const initialQ = searchParams?.get('q') || ''
  const focusId = searchParams?.get('focus') ?? null

  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchQuery, setSearchQuery] = useState(initialQ)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [tierFilter, setTierFilter] = useState('')

  const LIMIT = 20

  useEffect(() => {
    setSearchQuery(initialQ)
    setPage(0)
  }, [initialQ])

  useEffect(() => {
    if (!focusId || users.length === 0) return
    const u = users.find((x) => x.id === focusId)
    if (u) setEditingUser(u)
  }, [focusId, users])

  const fetchUsers = useCallback(async () => {
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: searchQuery, page: page.toString(), limit: LIMIT.toString() })
      if (tierFilter) params.set('tier', tierFilter)
      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (data.users) {
        setUsers(data.users)
        setTotal(data.total)
      }
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, page, tierFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleUpdateUser(userId: string, updates: Record<string, unknown>) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user_id: userId, ...updates }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('User updated')
        setEditingUser(null)
        fetchUsers()
      } else {
        showToast('Error: ' + (data.error || 'Failed'))
      }
    } catch {
      showToast('Network error')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  function exportPageCsv() {
    const headers = ['Name', 'Email', 'Plan', 'Role', 'Status', 'Last login', 'Joined', 'Items']
    const lines = [headers.join(',')]
    for (const u of users) {
      const plan = TIERS[(u.subscription_tier || 'free') as SubscriptionTier]?.displayName || u.subscription_tier
      let status = 'Active'
      if (u.is_banned) status = 'Inactive'
      else if (!u.last_sign_in_at) status = 'Pending'
      lines.push(
        [
          `"${(u.full_name || u.username || '').replace(/"/g, '""')}"`,
          `"${(u.email || '').replace(/"/g, '""')}"`,
          `"${plan}"`,
          u.is_admin ? 'Admin' : 'Member',
          status,
          u.last_sign_in_at || '',
          u.created_at || '',
          String(u.item_count ?? 0),
        ].join(',')
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wist-users-p${page + 1}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-4 z-[100] bg-violet-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-600" /> User management
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{total.toLocaleString()} users · search, edit plans, ban</p>
        </div>
        <Link
          href="/admin/banned"
          className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline self-start sm:self-auto"
        >
          Banned emails →
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search email, username, or name…"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900 focus:border-violet-400 outline-none"
          />
          {searching && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-violet-500" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <Filter className="w-4 h-4 text-zinc-400" />
            <select
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value)
                setPage(0)
              }}
              className="text-sm bg-transparent border-0 text-zinc-800 dark:text-zinc-200 focus:ring-0 cursor-pointer"
            >
              <option value="">All plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="creator">Creator</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <button
            type="button"
            onClick={exportPageCsv}
            disabled={users.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Export page
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {users.map((u) => {
            const tierKey = u.subscription_tier || 'free'
            const tierConfig = TIERS[tierKey as SubscriptionTier]
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setEditingUser(u)}
                className="w-full text-left p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-10 h-10 object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-violet-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {u.full_name || u.username || 'No name'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      {tierConfig?.displayName || tierKey} · {u.is_admin ? 'Admin' : 'Member'} · {u.item_count} items
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">User</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Plan</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Role</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Last login</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Joined</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Items</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !searching && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500">
                    No users found
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const tierKey = u.subscription_tier || 'free'
                const tierConfig = TIERS[tierKey as SubscriptionTier]
                return (
                  <tr
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingUser(u)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setEditingUser(u)
                      }
                    }}
                    className="border-b border-zinc-50 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-9 h-9 object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-violet-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {u.full_name || u.username || 'No name'}
                            {u.is_admin && (
                              <span className="ml-1.5 text-[10px] bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-semibold">
                                ADMIN
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${
                          TIER_BADGE_STYLES[tierKey] || TIER_BADGE_STYLES.free
                        }`}
                      >
                        <TierIcon tier={tierKey} />
                        {tierConfig?.displayName || 'Wist Free'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">{u.is_admin ? 'Admin' : 'Member'}</td>
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
                    <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">
                      {u.last_sign_in_at ? formatAdminDate(u.last_sign_in_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatAdminDate(u.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 tabular-nums">{u.item_count}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingUser(u)
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" /> Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Page {page + 1} of {totalPages} ({total} users)
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {editingUser && (
        <EditUserModal
          key={editingUser.id}
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
          saving={saving}
        />
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <UsersPageInner />
    </Suspense>
  )
}
