'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Zap, Shield, TrendingDown, Bell, Crown } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

const AD_CREATIVES = [
  {
    id: 'upgrade-stock',
    gradient: 'from-violet-500 to-indigo-600',
    icon: Shield,
    headline: 'Never miss a restock',
    body: 'Get back-in-stock alerts the moment your items are available again.',
    cta: 'Try Wist+',
    href: '/#pricing',
    accent: 'violet',
  },
  {
    id: 'upgrade-price',
    gradient: 'from-emerald-500 to-teal-600',
    icon: TrendingDown,
    headline: 'Track every price drop',
    body: 'Daily price checks and instant notifications so you never overpay.',
    cta: 'Upgrade now',
    href: '/#pricing',
    accent: 'emerald',
  },
  {
    id: 'upgrade-notify',
    gradient: 'from-amber-500 to-orange-600',
    icon: Bell,
    headline: 'Smart price alerts',
    body: 'We watch prices 24/7 and let you know the perfect time to buy.',
    cta: 'Get alerts',
    href: '/#pricing',
    accent: 'amber',
  },
  {
    id: 'upgrade-pro',
    gradient: 'from-pink-500 to-rose-600',
    icon: Crown,
    headline: 'Go unlimited',
    body: 'Unlimited items, daily price checks, receipt tracking, and more.',
    cta: 'See plans',
    href: '/#pricing',
    accent: 'pink',
  },
  {
    id: 'upgrade-features',
    gradient: 'from-blue-500 to-cyan-600',
    icon: Sparkles,
    headline: 'Wist+ starts at $5/mo',
    body: 'More items, faster checks, back-in-stock detection, and zero ads.',
    cta: 'Learn more',
    href: '/#pricing',
    accent: 'blue',
  },
  {
    id: 'upgrade-zap',
    gradient: 'from-purple-500 to-fuchsia-600',
    icon: Zap,
    headline: 'Instant notifications',
    body: 'Creator tier gets real-time price drop alerts the second they happen.',
    cta: 'Upgrade',
    href: '/#pricing',
    accent: 'purple',
  },
]

interface AdItemCardProps {
  index: number
  slotIndex: number
}

export default function AdItemCard({ index, slotIndex }: AdItemCardProps) {
  const { t } = useTranslation()
  const ad = AD_CREATIVES[slotIndex % AD_CREATIVES.length]
  const Icon = ad.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4), ease: [0.25, 0.1, 0.25, 1] }}
      className="relative mb-3 sm:mb-6 break-inside-avoid"
    >
      <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-beige-100 dark:bg-dpurple-900 border border-beige-200 dark:border-dpurple-700 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-violet-400 dark:hover:border-violet-700 transition-all duration-300">

        {/* Image Area - Gradient with Icon */}
        <div className={`relative w-full aspect-[4/3] bg-gradient-to-br ${ad.gradient} flex items-center justify-center overflow-hidden`}>
          {/* Decorative circles */}
          <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute bottom-6 left-6 w-12 h-12 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/5" />

          <div className="relative z-10 flex flex-col items-center gap-2 px-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <p className="text-white/90 text-xs sm:text-sm font-bold text-center leading-tight max-w-[160px]">
              {t(ad.headline)}
            </p>
          </div>

          {/* Sponsored label */}
          <span className="absolute top-2 right-2 text-[8px] sm:text-[9px] text-white/50 font-medium uppercase tracking-wider">
            {t('Sponsored')}
          </span>
        </div>

        {/* Content Area - Matches ItemCard structure */}
        <div className="p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
            {t(ad.body)}
          </p>

          {/* Footer - Matches ItemCard footer */}
          <div className="mt-2 sm:mt-4 flex items-end justify-between pt-2 sm:pt-4 border-t border-zinc-100 dark:border-dpurple-700">
            <div className="flex flex-col">
              <span className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500">Wist+</span>
              <span className="text-xs sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">$5/mo</span>
            </div>

            <Link
              href={ad.href}
              className="rounded-md sm:rounded-lg bg-violet-600 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white transition hover:bg-violet-700 inline-flex items-center gap-1"
            >
              {t(ad.cta)}
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
