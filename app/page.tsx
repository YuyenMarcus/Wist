'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

// Mock preview cards for the floating preview
const previewCards = [
  { title: 'Designer Watch', price: '$299', gradient: 'from-purple-400 to-pink-400' },
  { title: 'Wireless Headphones', price: '$149', gradient: 'from-blue-400 to-cyan-400' },
  { title: 'Minimalist Lamp', price: '$89', gradient: 'from-green-400 to-emerald-400' },
]

export default function LandingPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id })
      }
    })
  }, [])

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white selection:bg-violet-100">
      {/* Background Texture - Adds depth without clutter */}
      <div className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none" />
      
      {/* Lavender Gradient Orb - Keep this */}
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

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl px-4">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="mb-16"
        >
          {/* Headline */}
          <h1 className="text-6xl md:text-7xl font-bold text-zinc-900 mb-6 leading-tight">
            <span className="font-serif italic">Curate</span>{' '}
            <span className="font-sans">your life.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-zinc-600 mb-12 font-light leading-relaxed">
            The wishlist that respects your taste.
            <br />
            <span className="text-zinc-500">Private, shareable, and beautiful.</span>
          </p>

          {/* CTA Button */}
          <Link href={user ? '/dashboard' : '/signup'}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-violet-500 text-white rounded-full text-lg font-medium hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/30"
            >
              Get Started
            </motion.button>
          </Link>
        </motion.div>

        {/* Floating Preview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full px-4"
        >
          {previewCards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30, rotate: -5 + index * 5 }}
              animate={{ 
                opacity: 1, 
                y: [0, -20, 0],
                rotate: -5 + index * 5,
              }}
              transition={{
                duration: 3,
                delay: 0.5 + index * 0.2,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
              className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-xl"
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-90`} />
              
              {/* Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                  <p className="text-sm opacity-90">{card.price}</p>
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/50" />
            </motion.div>
          ))}
        </motion.div>

        {/* Footer Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-16 text-sm text-zinc-400 text-center"
        >
          Already have an account?{' '}
          <Link href="/login" className="text-violet-600 hover:text-violet-700 underline">
            Sign in
          </Link>
        </motion.p>
      </div>
    </div>
  )
}

