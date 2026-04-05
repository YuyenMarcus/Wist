'use client'

import { type SubscriptionTier } from '@/lib/constants/subscription-tiers'

const BADGE_CONFIG: Record<string, { colors: string[]; label: string }> = {
  pro: {
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

/** Crown (Creator tier) — matches Lucide crown silhouette, amber gradient */
function CrownMark({ colors, size = 14 }: { colors: string[]; size?: number }) {
  const id = `crown-grad-${colors[0].replace('#', '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <path
        d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"
        fill={`url(#${id})`}
      />
      <path d="M5 20.25h14v2.75H5z" fill={`url(#${id})`} />
    </svg>
  )
}

/** Diamond (Pro tier) — same gradient as legacy Pro badge */
function DiamondMark({ colors, size = 14 }: { colors: string[]; size?: number }) {
  const id = `diamond-grad-${colors[0].replace('#', '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <path d="M12 2l9 10-9 10-9-10 9-10z" fill={`url(#${id})`} />
    </svg>
  )
}

/** Plan card / headers — same gradient diamonds & crown as `TierBadge` */
export function ProTierIcon({ size = 16 }: { size?: number }) {
  return <DiamondMark colors={BADGE_CONFIG.pro.colors} size={size} />
}

export function CreatorTierIcon({ size = 16 }: { size?: number }) {
  return <CrownMark colors={BADGE_CONFIG.creator.colors} size={size} />
}

interface TierBadgeProps {
  tier: SubscriptionTier | string | null | undefined
  size?: 'sm' | 'md'
}

export default function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  if (!tier || tier === 'free') return null

  const config = BADGE_CONFIG[tier]
  if (!config) return null

  const markSize = size === 'sm' ? 14 : 18

  return (
    <span className="inline-flex items-center" title={`Wist ${config.label}`}>
      {tier === 'pro' ? (
        <DiamondMark colors={config.colors} size={markSize} />
      ) : tier === 'creator' ? (
        <CrownMark colors={config.colors} size={markSize} />
      ) : (
        <FourPointStar colors={config.colors} size={markSize} />
      )}
    </span>
  )
}
