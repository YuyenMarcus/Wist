'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Extend Window interface for TypeScript
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
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in - don't show One Tap if they are
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        return // User already logged in, don't show One Tap
      }
    }
    checkSession()

    // Define the callback function that Google will call upon success
    window.handleCredentialResponse = async (response) => {
      try {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
        })

        if (error) throw error

        console.log('✅ Google One Tap Success:', data)
        router.refresh()
        router.push('/dashboard') // Redirect to dashboard
      } catch (error) {
        console.error('❌ Google One Tap Error:', error)
      }
    }

    return () => {
      delete window.handleCredentialResponse
    }
  }, [router])

  // Don't render if no client ID is set
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
    return null
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          if (!window.google) {
            console.warn('Google Identity Services script failed to load')
            return
          }
          
          // Initialize Google One Tap
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            callback: window.handleCredentialResponse!,
            cancel_on_tap_outside: false, // Keep it open if they click away
            // auto_select: true // Optional: Auto-logs in returning users
          })

          // Show the prompt
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
              const reason = notification.getNotDisplayedReason()
              console.log('One Tap not displayed reason:', reason)
              // Common reasons:
              // - "browser_not_supported"
              // - "invalid_client"
              // - "opt_out_or_no_session"
              // - "suppressed_by_user"
              // - "unregistered_origin"
              // - "unknown_reason"
            }
          })
        }}
      />
    </>
  )
}
