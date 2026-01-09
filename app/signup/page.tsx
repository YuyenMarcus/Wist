'use client'

import { useState } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import GoogleOneTap from '@/components/GoogleOneTap'

export default function SignupPage() {
  const [message, setMessage] = useState<string | null>(null)

  // Handle signup success via Auth component's onSignup callback
  const handleSignup = () => {
    setMessage('Account created! Please check your email to confirm your account before signing in.')
    // Redirect to login after 3 seconds
    setTimeout(() => {
      window.location.href = 'https://wishlist.nuvio.cloud/login?signedup=true'
    }, 3000)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      {/* Google One Tap Component */}
      <GoogleOneTap />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Create your account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {message && (
          <div className="mb-4 rounded-md bg-green-50 p-4 text-green-800">
            <p className="text-sm font-medium">{message}</p>
            <p className="text-xs mt-1">Redirecting to login...</p>
          </div>
        )}

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            redirectTo="https://wishlist.nuvio.cloud/login?signedup=true"
            magicLink={false}
            onlyThirdPartyProviders={false}
            view="sign_up"
          />
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="https://wishlist.nuvio.cloud/login" className="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

