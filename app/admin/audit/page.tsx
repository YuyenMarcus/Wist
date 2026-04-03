'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScrollText, Filter, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

type AuditEvent = {
  id: string
  created_at: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
}

export default function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [queryNonce, setQueryNonce] = useState(0)
  const LIMIT = 25

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
      if (actionFilter.trim()) params.set('action', actionFilter.trim())
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/admin/audit?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (data.hint) setHint(data.hint)
      setEvents(Array.isArray(data.events) ? data.events : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [actionFilter, from, to, offset, queryNonce])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  function applyFilters() {
    setOffset(0)
    setQueryNonce((n) => n + 1)
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-violet-600" /> Audit log
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Time-ordered actions from the admin API (user updates, settings changes). Requires the{' '}
          <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">admin_audit_log</code> migration.
        </p>
      </div>

      {hint && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {hint}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-1">Action contains</label>
          <input
            type="text"
            placeholder="e.g. user.profile"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 min-w-[160px]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase text-zinc-400 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          />
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700"
        >
          Apply
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">When</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Action</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Actor</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Target</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">IP</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin inline text-violet-500" />
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500">
                    No events match your filters, or the audit table is not created yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-zinc-50 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">{ev.action}</td>
                    <td className="px-4 py-3 text-xs font-mono text-zinc-500">{ev.actor_id?.slice(0, 8) ?? '—'}…</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {ev.entity_type || '—'} {ev.entity_id ? <span className="font-mono text-zinc-400">{ev.entity_id.slice(0, 8)}…</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{ev.ip_address || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-[280px] truncate" title={JSON.stringify(ev.metadata)}>
                      {JSON.stringify(ev.metadata)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">
              Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                disabled={offset === 0}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOffset((o) => o + LIMIT)}
                disabled={offset + LIMIT >= total}
                className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
