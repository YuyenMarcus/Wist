'use client'

import { useEffect, useState, Suspense } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

// Custom purple theme to match the website
const purpleTheme = {
  theme: ThemeSupa,
  variables: {
    default: {
      colors: {
        brand: '#7c3aed',
        brandAccent: '#6d28d9',
        brandButtonText: 'white',
        defaultButtonBackground: '#f3f4f6',
        defaultButtonBackgroundHover: '#e5e7eb',
        inputBackground: 'white',
        inputBorder: '#d1d5db',
        inputBorderHover: '#7c3aed',
        inputBorderFocus: '#7c3aed',
      },
      radii: {
        borderRadiusButton: '8px',
        buttonBorderRadius: '8px',
        inputBorderRadius: '8px',
      },
    },
  },
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        window.location.href = '/dashboard'
      } else if (event === 'SIGNED_OUT') {
        setMessage(null)
        setMessageType(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [router, searchParams])

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })
      if (error) {
        setMessage(error.message)
        setMessageType('error')
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to sign in with Google')
      setMessageType('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {message && (
        <div className={`mb-4 rounded-lg p-4 ${
          messageType === 'success' 
            ? 'bg-violet-50 text-violet-800 border border-violet-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <p className="text-sm font-medium">{message}</p>
        </div>
      )}

      <div className="bg-white py-8 px-6 shadow-lg rounded-xl border border-zinc-200">
        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-zinc-300 rounded-lg text-zinc-700 font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-zinc-500">or sign in with email</span>
          </div>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={purpleTheme}
          providers={[]}
          redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/dashboard`}
          magicLink={false}
          onlyThirdPartyProviders={false}
          view="sign_in"
          showLinks={false}
        />
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
        By signing in, you agree to our{' '}
        <Link href="/terms" className="text-violet-500 hover:text-violet-600 underline underline-offset-2">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/terms#privacy" className="text-violet-500 hover:text-violet-600 underline underline-offset-2">
          Privacy Policy
        </Link>.
      </p>

      <div className="mt-4 text-center">
        <p className="text-sm text-zinc-600">
          Don't have an account?{' '}
          <Link href="/signup" className="text-violet-600 hover:text-violet-700 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Image src="/logo.svg" alt="Wist Logo" width={48} height={48} />
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Welcome back! Please enter your details.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}

