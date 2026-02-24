'use client'

import { type SubscriptionTier, TIERS } from '@/lib/constants/subscription-tiers'
import { Star, Gem, Crown, Building2, Sparkles } from 'lucide-react'

const TIER_ICONS: Record<string, typeof Star> = {
  pro: Sparkles,
  pro_plus: Gem,
  creator: Crown,
  enterprise: Building2,
}

const BADGE_STYLES: Record<string, string> = {
  pro: 'bg-blue-50 text-blue-700 border-blue-200',
  pro_plus: 'bg-violet-50 text-violet-700 border-violet-200',
  creator: 'bg-amber-50 text-amber-700 border-amber-200',
  enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const ICON_COLORS: Record<string, string> = {
  pro: 'text-blue-500',
  pro_plus: 'text-violet-500',
  creator: 'text-amber-500',
  enterprise: 'text-emerald-500',
}

interface TierBadgeProps {
  tier: SubscriptionTier | string | null | undefined
  size?: 'sm' | 'md'
}

export default function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  if (!tier || tier === 'free') return null

  const Icon = TIER_ICONS[tier]
  const config = TIERS[tier as SubscriptionTier]
  if (!Icon || !config) return null

  const style = BADGE_STYLES[tier] || ''
  const iconColor = ICON_COLORS[tier] || ''

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${style}`}>
        <Icon className={`w-3 h-3 ${iconColor}`} />
        {config.displayName.replace('Wist ', '')}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border ${style}`}>
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      {config.displayName}
    </span>
  )
}
