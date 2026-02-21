'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Check, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

function SharePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'saving' | 'success' | 'error' | 'no-url' | 'login'>('loading')
  const [message, setMessage] = useState('')
  const [itemTitle, setItemTitle] = useState('')

  useEffect(() => {
    const url = searchParams?.get('url') || searchParams?.get('text') || ''
    
    const extractedUrl = extractUrl(url)
    
    if (!extractedUrl) {
      setStatus('no-url')
      setMessage('No product URL provided.')
      return
    }

    saveToQueue(extractedUrl)
  }, [searchParams])

  function extractUrl(text: string): string | null {
    if (!text) return null
    try {
      new URL(text.trim())
      return text.trim()
    } catch {
      const urlMatch = text.match(/https?:\/\/[^\s]+/)
      return urlMatch ? urlMatch[0] : null
    }
  }

  async function saveToQueue(url: string) {
    setStatus('saving')
    setMessage('Saving to your queue...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('login')
        setMessage('Please log in to save items.')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ url }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save item')
      }

      setItemTitle(result.item?.title || 'Item')
      setStatus('success')
      setMessage('Saved to your wishlist!')

      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setStatus('error')
      setMessage(err.message || 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-zinc-200 p-8 text-center">
        <div className="mb-6">
          <Link href="/dashboard" className="text-2xl font-bold text-violet-600">
            Wist
          </Link>
        </div>

        {status === 'loading' || status === 'saving' ? (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto" />
            <p className="text-sm text-zinc-500">{message || 'Loading...'}</p>
          </div>
        ) : status === 'success' ? (
          <div className="space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="text-base font-medium text-zinc-900">{message}</p>
              {itemTitle && itemTitle !== 'Item' && (
                <p className="text-sm text-zinc-500 mt-1 truncate max-w-[280px] mx-auto">{itemTitle}</p>
              )}
            </div>
            <p className="text-xs text-zinc-400">Redirecting to dashboard...</p>
          </div>
        ) : status === 'login' ? (
          <div className="space-y-4">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <p className="text-sm text-zinc-700">{message}</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
            >
              Sign in
            </Link>
          </div>
        ) : status === 'no-url' ? (
          <div className="space-y-4">
            <ExternalLink className="w-10 h-10 text-zinc-400 mx-auto" />
            <p className="text-sm text-zinc-600">{message}</p>
            <p className="text-xs text-zinc-400">
              Use the Share button in your browser to send a product link to Wist.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-sm text-red-600">{message}</p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-2.5 bg-zinc-100 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    }>
      <SharePageContent />
    </Suspense>
  )
}
