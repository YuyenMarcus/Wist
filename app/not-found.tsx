'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-beige-50 dark:bg-dpurple-950 flex items-center justify-center relative overflow-hidden">
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <h1 className="text-[12rem] sm:text-[16rem] font-black text-violet-100 dark:text-violet-950/40 leading-none">
          404
        </h1>
      </motion.div>

      <div className="relative z-10 text-center px-6 max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mb-6"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-400">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Page not found
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
            This page doesn&apos;t exist, was removed, or the link might be broken. Try heading back home.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link href="/">
            <motion.button
              className="px-6 py-3 bg-violet-600 text-white rounded-full text-sm font-semibold shadow-sm"
              whileHover={{ scale: 1.04, backgroundColor: '#6d28d9' }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              Go Home
            </motion.button>
          </Link>
          <Link href="/support">
            <motion.button
              className="px-6 py-3 bg-beige-100 dark:bg-dpurple-800 text-zinc-700 dark:text-zinc-300 rounded-full text-sm font-medium border border-zinc-200 dark:border-dpurple-600"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              Get Help
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
