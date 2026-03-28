'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import GoogleOneTap from '@/components/GoogleOneTap'
import HeroV4 from '@/components/HeroV4'
import AppStoreSection from '@/components/AppStoreSection'
import PricingSection from '@/components/PricingSection'

export default function LandingPage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const isLoggedIn = !!user

  return (
    <main className="relative w-full overflow-hidden bg-white selection:bg-violet-100">
      <div className="organic-bg" aria-hidden="true">
        <div className="blob-a" />
        <div className="blob-b" />
        <div className="blob-c" />
      </div>
      {!isLoggedIn && <GoogleOneTap />}
      
      <HeroV4 isLoggedIn={isLoggedIn} />
      <AppStoreSection />
      <PricingSection />
    </main>
  )
}
