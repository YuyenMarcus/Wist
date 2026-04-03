'use client'

import { useEffect, useState } from 'react'
import { Shield, Plus, Save, Loader2, Check, Trash2 } from 'lucide-react'

const ACTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'banned', label: 'Banned' },
  { id: 'settings', label: 'Settings' },
  { id: 'roles', label: 'Roles' },
  { id: 'audit', label: 'Audit' },
] as const

type ActionId = (typeof ACTIONS)[number]['id']

const DEFAULT_MATRIX: Record<string, Record<string, boolean>> = {
  admin: { overview: true, users: true, banned: true, settings: true, roles: true, audit: true },
  editor: { overview: true, users: true, banned: false, settings: false, roles: false, audit: false },
  viewer: { overview: true, users: false, banned: false, settings: false, roles: false, audit: true },
  member: { overview: false, users: false, banned: false, settings: false, roles: false, audit: false },
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<string[]>(['admin', 'editor', 'viewer', 'member'])
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>(DEFAULT_MATRIX)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const rm = d.role_matrix
        if (rm?.matrix && typeof rm.matrix === 'object') {
          setMatrix(rm.matrix as Record<string, Record<string, boolean>>)
        }
        if (Array.isArray(rm?.roles) && rm.roles.length > 0) {
          setRoles(rm.roles as string[])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggle(role: string, action: ActionId) {
    setMatrix((m) => ({
      ...m,
      [role]: { ...m[role], [action]: !m[role]?.[action] },
    }))
  }

  function addCustomRole() {
    const key = newRoleName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!key || roles.includes(key)) return
    const blank = Object.fromEntries(ACTIONS.map((a) => [a.id, false])) as Record<string, boolean>
    setRoles((r) => [...r, key])
    setMatrix((m) => ({ ...m, [key]: blank }))
    setNewRoleName('')
    setShowAdd(false)
  }

  function removeRole(role: string) {
    if (['admin', 'member'].includes(role)) return
    setRoles((r) => r.filter((x) => x !== role))
    setMatrix((m) => {
      const next = { ...m }
      delete next[role]
      return next
    })
  }

  async function save() {
    setSaving(true)
    setToast('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role_matrix: { roles, matrix } }),
      })
      const data = await res.json()
      if (data.success) {
        setToast('Saved')
        setTimeout(() => setToast(''), 2500)
      } else setToast(data.error || 'Failed')
    } catch {
      setToast('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1100px] mx-auto space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Shield className="w-6 h-6 text-violet-600" /> Roles & permissions
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-2xl">
            Permission matrix stored in <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">admin_settings.role_matrix</code>.
            Today the console still requires <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">profiles.is_admin</code>; use this UI to
            document intent and prepare for finer RBAC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Plus className="w-4 h-4" /> Custom role
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 ${
            toast === 'Saved' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-800'
          }`}
        >
          {toast === 'Saved' && <Check className="w-4 h-4" />}
          {toast}
        </div>
      )}

      {showAdd && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Role key</label>
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. support_lead"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            />
          </div>
          <button type="button" onClick={addCustomRole} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium">
            Add
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-zinc-600">
            Cancel
          </button>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30">
              <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 w-36">Role</th>
              {ACTIONS.map((a) => (
                <th key={a.id} className="px-2 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 text-center">
                  {a.label}
                </th>
              ))}
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role} className="border-b border-zinc-50 dark:border-zinc-800/80">
                <td className="px-3 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 capitalize">{role.replace(/_/g, ' ')}</td>
                {ACTIONS.map((a) => (
                  <td key={a.id} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggle(role, a.id)}
                      className={`w-10 h-6 rounded-full mx-auto transition-colors relative ${
                        matrix[role]?.[a.id] ? 'bg-violet-600' : 'bg-zinc-200 dark:bg-zinc-600'
                      }`}
                      aria-pressed={matrix[role]?.[a.id]}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          matrix[role]?.[a.id] ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                ))}
                <td className="px-2 py-2">
                  {!['admin', 'member'].includes(role) && (
                    <button
                      type="button"
                      onClick={() => removeRole(role)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Remove role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
