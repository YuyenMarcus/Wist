'use client'

import { useEffect, useState, useCallback } from 'react'
import Script from 'next/script'
import { supabase } from '@/lib/supabase/client'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            cancel_on_tap_outside?: boolean
            auto_select?: boolean
          }) => void
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean
            getNotDisplayedReason: () => string
          }) => void) => void
        }
      }
    }
    handleCredentialResponse?: (response: { credential: string }) => Promise<void>
  }
}

export default function GoogleOneTap() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  const fallbackToOAuth = useCallback(async () => {
    console.log('🔄 [OneTap] Falling back to OAuth redirect flow...')
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session?.user)
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user)
    })

    window.handleCredentialResponse = async (response) => {
      try {
        console.log('🔑 [OneTap] Credential received, attempting signInWithIdToken...')
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        })

        if (error) {
          console.warn('⚠️ [OneTap] signInWithIdToken failed:', error.message, '— falling back to OAuth')
          await fallbackToOAuth()
          return
        }

        if (data?.session) {
          console.log('✅ [OneTap] Sign-in successful, redirecting...')
          window.location.href = '/dashboard'
        } else {
          console.warn('⚠️ [OneTap] No session returned — falling back to OAuth')
          await fallbackToOAuth()
        }
      } catch (error: any) {
        console.error('❌ [OneTap] Error:', error?.message || error)
        await fallbackToOAuth()
      }
    }

    return () => {
      subscription.unsubscribe()
      delete window.handleCredentialResponse
    }
  }, [fallbackToOAuth])

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || isLoggedIn === true) {
    return null
  }

  if (isLoggedIn === null) {
    return null
  }

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => {
        if (!window.google) return

        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) return

          window.google!.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            callback: window.handleCredentialResponse!,
            cancel_on_tap_outside: false,
          })

          window.google!.accounts.id.prompt()
        })
      }}
    />
  )
}
