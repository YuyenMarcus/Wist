'use client'

import { useState, useEffect, useCallback } from 'react'
import { Ban, Plus, Trash2, Loader2, Check } from 'lucide-react'
import type { BannedEmail } from '@/components/admin/types'

export default function AdminBannedPage() {
  const [bannedEmails, setBannedEmails] = useState<BannedEmail[]>([])
  const [newBanEmail, setNewBanEmail] = useState('')
  const [newBanReason, setNewBanReason] = useState('')
  const [addingBan, setAddingBan] = useState(false)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchBannedEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/banned-emails', { credentials: 'include' })
      const data = await res.json()
      if (data.emails) setBannedEmails(data.emails)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBannedEmails()
  }, [fetchBannedEmails])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
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
    } catch {
      showToast('Network error')
    } finally {
      setAddingBan(false)
    }
  }

  async function handleRemoveBan(email: string) {
    try {
      await fetch(`/api/admin/banned-emails?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      showToast('Ban removed')
      fetchBannedEmails()
    } catch {
      showToast('Network error')
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-20 right-4 z-[100] bg-violet-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4" /> {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <Ban className="w-6 h-6 text-red-500" /> Banned emails
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Block signups and access for specific addresses.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ban an email
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={newBanEmail}
            onChange={(e) => setNewBanEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900 outline-none"
          />
          <input
            type="text"
            value={newBanReason}
            onChange={(e) => setNewBanReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-violet-200 outline-none"
          />
          <button
            type="button"
            onClick={handleAddBan}
            disabled={addingBan || !newBanEmail.trim()}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {addingBan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
            Ban
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
          </div>
        ) : bannedEmails.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No banned emails</div>
        ) : (
          <ul>
            {bannedEmails.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3 border-b border-zinc-50 dark:border-zinc-800 last:border-0 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{b.email}</p>
                  <p className="text-xs text-zinc-500">
                    {b.reason || 'No reason'} · {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBan(b.email)}
                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                  aria-label="Remove ban"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
