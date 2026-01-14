'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShoppingBag, Bell, TrendingDown, ArrowRight, Sparkles, Download, Shield, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

export default function ExtensionLandingPage() {
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
    <main className="relative min-h-screen w-full flex flex-col items-center overflow-hidden bg-white selection:bg-violet-100">
      
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-6 md:px-12">
        <Link href="/" className="flex items-center gap-2">
          <img 
            src="/logo.svg" 
            alt="Wist Logo" 
            className="h-10 w-10"
          />
          <span className="font-bold text-xl tracking-tight text-zinc-900">wist.</span>
        </Link>

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

      {/* Background Elements */}
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

      {/* Hero Section */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 w-full max-w-6xl mx-auto mt-20 py-20">
        
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex items-center gap-2 rounded-full border border-violet-100 bg-white/50 px-3 py-1 text-xs font-medium text-violet-600 backdrop-blur-sm shadow-sm"
        >
          <Sparkles size={12} />
          <span>Now supporting Amazon, Target, & Etsy</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center text-5xl font-bold tracking-tight text-zinc-900 md:text-7xl lg:text-8xl mb-6"
        >
          Stop leaving tabs open.<br />
          <span className="font-serif italic text-violet-500">Start saving money.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 max-w-2xl text-center text-xl text-zinc-500 leading-relaxed mb-10"
        >
          The universal wishlist button for Chrome. Save items from any store in one click, 
          and we'll email you the moment the price drops.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="download-extension-btn group flex h-14 items-center gap-3 rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition-all hover:bg-zinc-800 hover:shadow-xl hover:-translate-y-1"
          >
            <Download className="h-5 w-5" />
            Add to Chrome - It's Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          
          <p className="text-sm text-zinc-400 flex items-center gap-1">
            <span>⭐⭐⭐⭐⭐</span>
            <span>Trusted by smart shoppers</span>
          </p>
        </motion.div>
      </div>

      {/* Supported Stores Banner */}
      <section className="relative z-10 w-full border-y border-zinc-100 bg-zinc-50 py-10 mt-10">
        <p className="text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-6">
          Works seamlessly on your favorite sites
        </p>
        <div className="flex flex-wrap justify-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <span className="text-2xl font-bold text-zinc-800">Amazon</span>
          <span className="text-2xl font-bold text-zinc-800">Target</span>
          <span className="text-2xl font-bold text-zinc-800">Etsy</span>
          <span className="text-2xl font-bold text-zinc-800">Walmart</span>
          <span className="text-2xl font-bold text-zinc-800">Best Buy</span>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
              <ShoppingBag size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-zinc-900">One List for Everything</h3>
            <p className="text-zinc-600 leading-relaxed">
              No more screenshots or bookmarks folders. Keep your tech, fashion, and home decor ideas in one beautiful, organized place.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition"
          >
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-6">
              <TrendingDown size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-zinc-900">Price History Overlay</h3>
            <p className="text-zinc-600 leading-relaxed">
              See the price history <strong>while you browse</strong>. Know instantly if that "deal" is actually a deal before you buy.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-8 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
              <Bell size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3 text-zinc-900">Instant Drop Alerts</h3>
            <p className="text-zinc-600 leading-relaxed">
              We watch the price 24/7. When it drops, you get an email. You'll never overpay for a gift again.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 bg-zinc-900 text-white py-20 px-6 text-center w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to stop overpaying?</h2>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-violet-600 text-white rounded-xl font-bold text-lg hover:bg-violet-500 transition shadow-lg"
          >
            <Download size={20} />
            Add Wist to Chrome
          </a>
        </motion.div>
      </section>
    </main>
  )
}
