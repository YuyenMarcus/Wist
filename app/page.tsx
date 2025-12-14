'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

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
    <main className="relative min-h-screen w-full flex flex-col items-center overflow-hidden bg-white selection:bg-violet-100">
      
      {/* --- 1. FIXED NAV BAR (Restores Sign In) --- */}
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.svg" 
            alt="Wist Logo" 
            className="h-10 w-10"
          />
          <span className="font-bold text-xl tracking-tight text-zinc-900">wist.</span>
        </div>

        {/* --- CONDITIONAL NAV LOGIC --- */}
        <div className="flex items-center gap-6">
          {isLoggedIn ? (
            <Link 
              href="/dashboard" 
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-all flex items-center gap-2"
            >
              Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link 
                href="/login" 
                className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Sign in
              </Link>
              <Link 
                href="/signup" 
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-all"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* --- Background Elements --- */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8b5cf60a_1px,transparent_1px),linear-gradient(to_bottom,#8b5cf60a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(circle_at_center,black,transparent_80%)] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 0.3, 
          scale: 1,
          x: [0, 50, -30, 0],
          y: [0, -40, 30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-200/30 blur-[100px] rounded-full pointer-events-none z-0"
      />

      {/* --- 2. CENTERED HERO SECTION --- */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 w-full max-w-4xl mx-auto mt-10">
        
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex items-center gap-2 rounded-full border border-violet-100 bg-white/50 px-3 py-1 text-xs font-medium text-violet-600 backdrop-blur-sm shadow-sm"
        >
          <Sparkles size={12} />
          <span>Reimagining the wishlist</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center text-5xl font-bold tracking-tight text-zinc-900 md:text-7xl lg:text-8xl"
        >
          Curate your <br />
          <span className="font-serif italic text-violet-500">digital life.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 max-w-lg text-center text-lg text-zinc-500 leading-relaxed"
        >
          Stop saving links in random notes. Collect, organize, and share your wishlist in a space designed for clarity.
        </motion.p>

        {/* --- CONDITIONAL BUTTON LOGIC --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex w-full items-center justify-center gap-4"
        >
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="group flex h-12 items-center gap-2 rounded-full bg-violet-500 px-8 text-sm font-semibold text-white transition-all hover:bg-violet-600 hover:pr-6"
            >
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="group flex h-12 items-center gap-2 rounded-full bg-violet-500 px-8 text-sm font-semibold text-white transition-all hover:bg-violet-600 hover:pr-6"
              >
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login"
                className="flex h-12 items-center rounded-full bg-white px-8 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 hover:ring-zinc-300"
              >
                Log in
              </Link>
            </>
          )}
        </motion.div>

        {/* Floating Preview Card (Optional visual flare) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 relative w-full max-w-lg"
        >
           {/* You can add a preview image here later */}
        </motion.div>
      </div>
    </main>
  )
}
