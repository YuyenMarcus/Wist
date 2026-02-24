'use client'

import { type SubscriptionTier } from '@/lib/constants/subscription-tiers'

const BADGE_CONFIG: Record<string, { colors: string[]; label: string }> = {
  pro: {
    colors: ['#3b82f6', '#6366f1'],
    label: 'Plus',
  },
  pro_plus: {
    colors: ['#8b5cf6', '#9333ea'],
    label: 'Pro',
  },
  creator: {
    colors: ['#f59e0b', '#f97316'],
    label: 'Creator',
  },
  enterprise: {
    colors: ['#10b981', '#14b8a6'],
    label: 'Enterprise',
  },
}

function FourPointStar({ colors, size = 14 }: { colors: string[]; size?: number }) {
  const id = `star-grad-${colors[0].replace('#', '')}`;
  // 4-point star: top, right, bottom, left with curved inner edges
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <path
        d="M12 0L14.4 9.6L24 12L14.4 14.4L12 24L9.6 14.4L0 12L9.6 9.6L12 0Z"
        fill={`url(#${id})`}
      />
    </svg>
  )
}

interface TierBadgeProps {
  tier: SubscriptionTier | string | null | undefined
  size?: 'sm' | 'md'
}

export default function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  if (!tier || tier === 'free') return null

  const config = BADGE_CONFIG[tier]
  if (!config) return null

  const starSize = size === 'sm' ? 14 : 18

  return (
    <span className="inline-flex items-center" title={`Wist ${config.label}`}>
      <FourPointStar colors={config.colors} size={starSize} />
    </span>
  )
}
