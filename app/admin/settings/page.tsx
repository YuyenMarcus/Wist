'use client'

import { useEffect, useState } from 'react'
import { Globe, Shield, Plug, Palette, Save, Loader2, Check } from 'lucide-react'

type SitePrefs = {
  siteName?: string
  timezone?: string
  language?: string
  sessionTimeoutDays?: string
  enforce2FA?: boolean
  minPasswordLength?: number
  webhookUrl?: string
  apiKeyHint?: string
  logoUrl?: string
  primaryColor?: string
  emailTemplateNote?: string
}

const defaultPrefs: SitePrefs = {
  siteName: 'Wist',
  timezone: 'America/New_York',
  language: 'en',
  sessionTimeoutDays: '7',
  enforce2FA: false,
  minPasswordLength: 8,
  webhookUrl: '',
  apiKeyHint: '',
  logoUrl: '',
  primaryColor: '#7c3aed',
  emailTemplateNote: '',
}

export default function AdminSettingsPage() {
  const [prefs, setPrefs] = useState<SitePrefs>(defaultPrefs)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.site_prefs && typeof d.site_prefs === 'object') {
          setPrefs({ ...defaultPrefs, ...d.site_prefs })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setToast('')
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ site_prefs: prefs }),
      })
      const data = await res.json()
      if (data.success) {
        setToast('Saved')
        setTimeout(() => setToast(''), 2500)
      } else setToast(data.error || 'Save failed')
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
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-10 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Console preferences stored in <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">admin_settings</code>.
            Wire product features to read these keys when you are ready.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save changes
        </button>
      </div>

      {toast && (
        <div
          className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 ${
            toast === 'Saved' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {toast === 'Saved' && <Check className="w-4 h-4" />}
          {toast}
        </div>
      )}

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
          <Globe className="w-5 h-5 text-violet-600" /> General
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide">Site name</label>
          <input
            value={prefs.siteName ?? ''}
            onChange={(e) => setPrefs((p) => ({ ...p, siteName: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Timezone</label>
              <select
                value={prefs.timezone ?? 'America/New_York'}
                onChange={(e) => setPrefs((p) => ({ ...p, timezone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="America/New_York">Eastern (US)</option>
                <option value="America/Chicago">Central (US)</option>
                <option value="America/Denver">Mountain (US)</option>
                <option value="America/Los_Angeles">Pacific (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Language</label>
              <select
                value={prefs.language ?? 'en'}
                onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
          <Shield className="w-5 h-5 text-violet-600" /> Security
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">Require 2FA for admins (policy flag)</span>
          <button
            type="button"
            onClick={() => setPrefs((p) => ({ ...p, enforce2FA: !p.enforce2FA }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${prefs.enforce2FA ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                prefs.enforce2FA ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Session timeout (days)</label>
          <input
            type="number"
            min={1}
            max={90}
            value={prefs.sessionTimeoutDays ?? '7'}
            onChange={(e) => setPrefs((p) => ({ ...p, sessionTimeoutDays: e.target.value }))}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Minimum password length</label>
          <input
            type="number"
            min={6}
            max={128}
            value={prefs.minPasswordLength ?? 8}
            onChange={(e) => setPrefs((p) => ({ ...p, minPasswordLength: parseInt(e.target.value, 10) || 8 }))}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
          <Plug className="w-5 h-5 text-violet-600" /> Integrations
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Webhook URL (outbound events)</label>
          <input
            value={prefs.webhookUrl ?? ''}
            onChange={(e) => setPrefs((p) => ({ ...p, webhookUrl: e.target.value }))}
            placeholder="https://…"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-mono text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">API key label / hint (never store secrets in plain text)</label>
          <input
            value={prefs.apiKeyHint ?? ''}
            onChange={(e) => setPrefs((p) => ({ ...p, apiKeyHint: e.target.value }))}
            placeholder="e.g. Last 4 chars or Vault reference"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
          <Palette className="w-5 h-5 text-violet-600" /> Appearance
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Logo URL</label>
          <input
            value={prefs.logoUrl ?? ''}
            onChange={(e) => setPrefs((p) => ({ ...p, logoUrl: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Primary brand color</label>
            <input
              type="color"
              value={prefs.primaryColor ?? '#7c3aed'}
              onChange={(e) => setPrefs((p) => ({ ...p, primaryColor: e.target.value }))}
              className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">Email templates note</label>
          <textarea
            value={prefs.emailTemplateNote ?? ''}
            onChange={(e) => setPrefs((p) => ({ ...p, emailTemplateNote: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
            placeholder="Pointers for transactional copy, links to Figma, etc."
          />
        </div>
      </section>
    </div>
  )
}
