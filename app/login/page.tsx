'use client'

import { useEffect, useState, Suspense } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null)

  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    if (!searchParams) return

    // Check for email confirmation message
    const confirmed = searchParams.get('confirmed')
    if (confirmed === 'true') {
      setMessage('Email confirmed! You can now sign in.')
      setMessageType('success')
    }

    // Check for signup success
    const signedUp = searchParams.get('signedup')
    if (signedUp === 'true') {
      setMessage('Check your email to confirm your account before signing in.')
      setMessageType('success')
    }

    // Check for error message
    const error = searchParams.get('error')
    if (error) {
      setMessage(decodeURIComponent(error))
      setMessageType('error')
    }

    // Check if user is already logged in (only once on mount)
    let isMounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setCheckingAuth(false)
        if (session) {
          // Use window.location to force full page reload and clear any state issues
          window.location.href = '/dashboard'
        }
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Wait for cookies to be set and use full page reload
        await new Promise(resolve => setTimeout(resolve, 1000))
        window.location.href = '/dashboard'
      } else if (event === 'SIGNED_OUT') {
        // Clear any cached state on sign out
        setMessage(null)
        setMessageType(null)
        setCheckingAuth(false)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Don't redirect on token refresh, just update state
        setCheckingAuth(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [router, searchParams])

  // Show loading state while checking auth
  if (checkingAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {message && (
        <div className={`mb-4 rounded-md p-4 ${
          messageType === 'success' 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          <p className="text-sm font-medium">{message}</p>
        </div>
      )}

      <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/dashboard`}
          magicLink={false}
          onlyThirdPartyProviders={false}
          view="sign_in"
        />
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Sign in to your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

