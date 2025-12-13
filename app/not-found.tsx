'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center relative overflow-hidden">
      {/* Background 404 */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-9xl font-black text-zinc-200 select-none">
          404
        </h1>
      </motion.div>

      {/* Foreground Content */}
      <div className="relative z-10 text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h2 className="text-2xl font-semibold text-zinc-900 mb-2">
            This item is out of stock...
          </h2>
        </motion.div>

        <motion.p
          className="text-zinc-600 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          or never existed.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Link href="/">
            <motion.button
              className="px-6 py-3 bg-zinc-900 text-white rounded-full text-sm font-medium"
              whileHover={{
                scale: 1.05,
                backgroundColor: '#27272a', // zinc-800
              }}
              whileTap={{
                scale: 0.95,
              }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 17,
              }}
            >
              Go Home
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

