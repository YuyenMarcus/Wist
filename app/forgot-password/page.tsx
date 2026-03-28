'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/context'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError(t('Please enter your email address.'))
      return
    }

    setLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${origin}/auth/callback?next=/update-password`,
      })
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Something went wrong.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-4 flex justify-center">
          <Image src="/logo.svg" alt="Wist Logo" width={48} height={48} />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          {t('Reset your password')}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          {t("Enter the email for your account and we'll send you a reset link.")}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-lg">
          {sent ? (
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-800">
                {t('Check your email')}
              </p>
              <p className="mt-2 text-sm text-zinc-600">
                {t('If an account exists for that address, we sent a link to reset your password.')}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
              >
                {t('Back to sign in')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="forgot-email" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t('Email')}
                </label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-violet-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t('Sending...') : t('Send reset link')}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600">
          <Link href="/login" className="font-medium text-violet-600 hover:text-violet-700">
            {t('Back to sign in')}
          </Link>
        </p>
      </div>
    </div>
  )
}
