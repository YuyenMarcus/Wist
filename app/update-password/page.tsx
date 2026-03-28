'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/i18n/context'

const MIN_LEN = 6

export default function UpdatePasswordPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(!!session)
        setChecking(false)
      }
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setHasSession(!!session)
      setChecking(false)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_LEN) {
      setError(t('Password must be at least 6 characters.'))
      return
    }
    if (password !== confirm) {
      setError(t('Passwords do not match.'))
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Something went wrong.'))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-zinc-500">{t('Loading...')}</p>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <Image src="/logo.svg" alt="Wist Logo" width={48} height={48} />
          </div>
          <h2 className="text-xl font-bold text-zinc-900">{t('Link invalid or expired')}</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {t('Request a new reset link and try again.')}
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            {t('Forgot password?')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-4 flex justify-center">
          <Image src="/logo.svg" alt="Wist Logo" width={48} height={48} />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          {t('Choose a new password')}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          {t('Use at least 6 characters.')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-zinc-200 bg-white px-6 py-8 shadow-lg"
        >
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="new-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t('New password')}
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_LEN}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-violet-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t('Confirm password')}
            </label>
            <input
              id="confirm-password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_LEN}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-violet-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t('Saving...') : t('Update password')}
          </button>
        </form>
      </div>
    </div>
  )
}
