'use client'

import { useState } from 'react'
import { Loader2, Send, CheckCircle } from 'lucide-react'

export default function SupportContactForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message, _hp: honeypot }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not send. Please try again.')
        return
      }
      setSent(true)
      setMessage('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-6 py-8 text-center">
        <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-emerald-900">Message sent</p>
        <p className="text-sm text-emerald-800/90 mt-1">
          Thanks — we&apos;ll get back to you at <span className="font-medium">{email}</span>.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-xs font-medium text-emerald-700 hover:underline"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="text-left max-w-md mx-auto space-y-4">
      <div className="hidden" aria-hidden>
        <label htmlFor="support-website">Website</label>
        <input
          id="support-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
        />
      </div>
      <div>
        <label htmlFor="support-email" className="block text-xs font-medium text-zinc-600 mb-1.5">
          Your email
        </label>
        <input
          id="support-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
        />
      </div>
      <div>
        <label htmlFor="support-message" className="block text-xs font-medium text-zinc-600 mb-1.5">
          How can we help?
        </label>
        <textarea
          id="support-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your question or issue…"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 resize-y min-h-[120px]"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 text-white text-sm font-semibold px-4 py-3 hover:bg-violet-700 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send message
          </>
        )}
      </button>
      <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
        We only use your email to reply to this message. We don&apos;t share it with third parties for marketing.
      </p>
    </form>
  )
}
