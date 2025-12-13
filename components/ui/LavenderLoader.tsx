'use client'

import { motion } from 'framer-motion'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LavenderLoader({ size = 'md', className = '' }: LoaderProps) {
  // Size mapping
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  const dotSize = sizeClasses[size]

  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={`${dotSize} rounded-full bg-violet-500`}
          initial={{ y: 0, opacity: 0.6 }}
          animate={{
            y: [-4, 4, -4],        // Gentle bounce
            opacity: [0.4, 1, 0.4], // Soft glow pulse
            scale: [0.9, 1.1, 0.9], // Breathing effect
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2, // Stagger the animation for the "wave" look
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

