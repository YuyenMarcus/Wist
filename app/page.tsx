'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import GoogleOneTap from '@/components/GoogleOneTap'
import HeroV4 from '@/components/HeroV4'

export default function LandingPage() {
  const [user, setUser] = useState<any>(null)

  // Check authentication status on mount and listen for changes
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    // Listen for auth state changes (sign in/sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Boolean helper for readability
  const isLoggedIn = !!user

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white selection:bg-violet-100">
      {/* Google One Tap Component - Only shows for logged-out users */}
      {!isLoggedIn && <GoogleOneTap />}
      
      <HeroV4 isLoggedIn={isLoggedIn} />
    </main>
  )
}
