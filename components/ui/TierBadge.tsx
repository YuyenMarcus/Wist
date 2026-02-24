'use client'

import { type SubscriptionTier, TIERS } from '@/lib/constants/subscription-tiers'

const BADGE_CONFIG: Record<string, { gradient: string; glow: string; label: string }> = {
  pro: {
    gradient: 'from-blue-500 to-indigo-500',
    glow: 'shadow-blue-500/20',
    label: 'Plus',
  },
  pro_plus: {
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/25',
    label: 'Pro',
  },
  creator: {
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/25',
    label: 'Creator',
  },
  enterprise: {
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    label: 'Enterprise',
  },
}

interface TierBadgeProps {
  tier: SubscriptionTier | string | null | undefined
  size?: 'sm' | 'md'
}

export default function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  if (!tier || tier === 'free') return null

  const config = BADGE_CONFIG[tier]
  if (!config) return null

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold tracking-wide text-white rounded-md bg-gradient-to-r ${config.gradient} shadow-sm ${config.glow}`}>
        {config.label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white rounded-md bg-gradient-to-r ${config.gradient} shadow-sm ${config.glow}`}>
      {config.label}
    </span>
  )
}
