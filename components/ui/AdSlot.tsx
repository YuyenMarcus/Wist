'use client'

import { type SubscriptionTier } from '@/lib/constants/subscription-tiers'
import { Megaphone, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface AdSlotProps {
  variant: 'banner' | 'inline' | 'sidebar'
  tier: SubscriptionTier | string | null | undefined
}

export default function AdSlot({ variant, tier }: AdSlotProps) {
  if (tier && tier !== 'free') return null

  if (variant === 'banner') {
    return (
      <div
        className="w-full max-w-2xl mx-auto px-4"
        data-ad-slot="dashboard-banner"
      >
        <div className="relative rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-4 flex items-center justify-between gap-4 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Megaphone className="w-4 h-4 text-violet-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-700 truncate">Upgrade to remove ads</p>
              <p className="text-xs text-zinc-400">Wist+ starts at $5/mo</p>
            </div>
          </div>
          <Link
            href="/signup"
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
          >
            Upgrade <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="absolute top-1.5 right-1.5 text-[9px] text-zinc-300 font-medium uppercase tracking-wider">Ad</span>
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div
        className="break-inside-avoid mb-3 sm:mb-6"
        data-ad-slot="grid-inline"
      >
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-5 flex flex-col items-center justify-center text-center min-h-[180px] relative">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
            <Megaphone className="w-5 h-5 text-violet-500" />
          </div>
          <p className="text-sm font-medium text-zinc-600 mb-1">Your ad here</p>
          <p className="text-xs text-zinc-400 mb-3">Sponsored placement</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
          >
            Go ad-free <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="absolute top-2 right-2 text-[9px] text-zinc-300 font-medium uppercase tracking-wider">Ad</span>
        </div>
      </div>
    )
  }

  if (variant === 'sidebar') {
    return (
      <div
        className="mx-3 mb-3"
        data-ad-slot="sidebar"
      >
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-3 flex flex-col items-center text-center relative">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center mb-2">
            <Megaphone className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-[11px] font-medium text-zinc-500 mb-2">Sponsored</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-md hover:bg-violet-100 transition-colors"
          >
            Go ad-free <ArrowRight className="w-2.5 h-2.5" />
          </Link>
          <span className="absolute top-1.5 right-1.5 text-[8px] text-zinc-300 font-medium uppercase tracking-wider">Ad</span>
        </div>
      </div>
    )
  }

  return null
}
