'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { getProfile } from '@/lib/supabase/profile'
import PageTransition from '@/components/ui/PageTransition'
import {
  Search, Shield, Users, Ban, Crown, Star, User,
  Loader2, ChevronLeft, ChevronRight, X, Plus, Trash2,
  AlertTriangle, Check, ArrowLeft,
} from 'lucide-react'

type Tab = 'users' | 'banned'

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  subscription_tier: string
  is_admin: boolean
  is_banned: boolean
  ban_reason: string | null
  age: number | null
  item_count: number
}

interface BannedEmail {
  id: string
  email: string
  reason: string | null
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('users')

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Banned emails state
  const [bannedEmails, setBannedEmails] = useState<BannedEmail[]>([])
  const [newBanEmail, setNewBanEmail] = useState('')
  const [newBanReason, setNewBanReason] = useState('')
  const [addingBan, setAddingBan] = useState(false)

  const LIMIT = 20

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await getProfile(user.id)
      if (!profile?.is_admin) { router.push('/dashboard'); return }
      setAuthorized(true)
      setLoading(false)
    }
    checkAdmin()
  }, [router])

  const fetchUsers = useCallback(async () => {
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: searchQuery, page: page.toString(), limit: LIMIT.toString() })
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
  }, [searchQuery, page])

  const fetchBannedEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/banned-emails', { credentials: 'include' })
      const data = await res.json()
      if (data.emails) setBannedEmails(data.emails)
    } catch (err) {
      console.error('Failed to fetch banned emails:', err)
    }
  }, [])

  useEffect(() => {
    if (!authorized) return
    if (tab === 'users') fetchUsers()
    if (tab === 'banned') fetchBannedEmails()
  }, [authorized, tab, fetchUsers, fetchBannedEmails])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleUpdateUser(userId: string, updates: Record<string, any>) {
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
    } catch { showToast('Network error') }
    finally { setSaving(false) }
  }

  async function handleAddBan() {
    if (!newBanEmail.trim()) return
    setAddingBan(true)
    try {
      const res = await fetch('/api/admin/banned-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: newBanEmail.trim(), reason: newBanReason.trim() || null }),
      })
      const data = await res.json()
      if (data.success) {
        showToast('Email banned')
        setNewBanEmail('')
        setNewBanReason('')
        fetchBannedEmails()
      }
    } catch { showToast('Network error') }
    finally { setAddingBan(false) }
  }

  async function handleRemoveBan(email: string) {
    try {
      await fetch(`/api/admin/banned-emails?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      showToast('Ban removed')
      fetchBannedEmails()
    } catch { showToast('Network error') }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    )
  }

  if (!authorized) return null

  const totalPages = Math.ceil(total / LIMIT)

  const tierIcon = (tier: string) => {
    if (tier === 'creator') return <Crown className="w-3.5 h-3.5 text-amber-500" />
    if (tier === 'pro') return <Star className="w-3.5 h-3.5 text-violet-500" />
    return <User className="w-3.5 h-3.5 text-zinc-400" />
  }

  const tierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      creator: 'bg-amber-50 text-amber-700 border-amber-200',
      pro: 'bg-violet-50 text-violet-700 border-violet-200',
      free: 'bg-zinc-50 text-zinc-600 border-zinc-200',
    }
    return colors[tier] || colors.free
  }

  return (
    <PageTransition className="min-h-screen bg-zinc-50">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-violet-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-zinc-200 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              <Shield className="w-6 h-6 text-violet-600" /> Admin Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">{total} total users</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-zinc-200 p-1 w-fit">
          <button
            onClick={() => setTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'users' ? 'bg-violet-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Users className="w-4 h-4" /> Users
          </button>
          <button
            onClick={() => setTab('banned')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'banned' ? 'bg-violet-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Ban className="w-4 h-4" /> Banned Emails
          </button>
        </div>

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0) }}
                placeholder="Search by email, username, or name..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none transition"
              />
              {searching && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin text-violet-500" />}
            </div>

            {/* User List */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-zinc-50 border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <div className="col-span-4">User</div>
                <div className="col-span-2">Plan</div>
                <div className="col-span-2">Items</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Actions</div>
              </div>

              {users.length === 0 && !searching && (
                <div className="p-8 text-center text-sm text-zinc-400">No users found</div>
              )}

              {users.map(u => (
                <div key={u.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors items-center">
                  {/* User info */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-violet-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {u.full_name || u.username || 'No name'}
                        {u.is_admin && <span className="ml-1.5 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">ADMIN</span>}
                      </p>
                      <p className="text-xs text-zinc-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  {/* Plan */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${tierBadge(u.subscription_tier)}`}>
                      {tierIcon(u.subscription_tier)}
                      {(u.subscription_tier || 'free').charAt(0).toUpperCase() + (u.subscription_tier || 'free').slice(1)}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="col-span-2 text-sm text-zinc-600">{u.item_count} items</div>

                  {/* Status */}
                  <div className="col-span-2">
                    {u.is_banned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-200">
                        <Ban className="w-3 h-3" /> Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex gap-1.5">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="px-3 py-1.5 text-xs font-medium bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  Page {page + 1} of {totalPages} ({total} users)
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Banned Emails Tab */}
        {tab === 'banned' && (
          <div className="space-y-4">
            {/* Add ban form */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Ban an Email
              </h3>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="email"
                  value={newBanEmail}
                  onChange={(e) => setNewBanEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
                />
                <input
                  type="text"
                  value={newBanReason}
                  onChange={(e) => setNewBanReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="flex-1 min-w-[150px] px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
                />
                <button
                  onClick={handleAddBan}
                  disabled={addingBan || !newBanEmail.trim()}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {addingBan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  Ban
                </button>
              </div>
            </div>

            {/* Banned list */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              {bannedEmails.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">No banned emails</div>
              ) : (
                bannedEmails.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b border-zinc-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{b.email}</p>
                      <p className="text-xs text-zinc-400">
                        {b.reason || 'No reason'} — {new Date(b.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveBan(b.email)}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
          saving={saving}
        />
      )}
    </PageTransition>
  )
}

function EditUserModal({
  user,
  onClose,
  onSave,
  saving,
}: {
  user: AdminUser
  onClose: () => void
  onSave: (id: string, updates: Record<string, any>) => void
  saving: boolean
}) {
  const [tier, setTier] = useState(user.subscription_tier || 'free')
  const [banned, setBanned] = useState(user.is_banned)
  const [banReason, setBanReason] = useState(user.ban_reason || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Edit User</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-violet-500" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900">{user.full_name || user.username || 'No name'}</p>
            <p className="text-xs text-zinc-400">{user.email}</p>
          </div>
        </div>

        {/* Subscription tier */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">Subscription Plan</label>
          <div className="grid grid-cols-3 gap-2">
            {(['free', 'pro', 'creator'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                  tier === t
                    ? 'border-violet-500 bg-violet-50'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {t === 'free' && <User className="w-5 h-5 text-zinc-500" />}
                {t === 'pro' && <Star className="w-5 h-5 text-violet-500" />}
                {t === 'creator' && <Crown className="w-5 h-5 text-amber-500" />}
                <span className="text-xs font-semibold capitalize">{t}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ban toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Ban User
            </label>
            <button
              type="button"
              onClick={() => setBanned(!banned)}
              className={`relative w-11 h-6 rounded-full transition-colors ${banned ? 'bg-red-500' : 'bg-zinc-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${banned ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {banned && (
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ban reason"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(user.id, {
              subscription_tier: tier,
              is_banned: banned,
              ban_reason: banned ? banReason : null,
            })}
            disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
