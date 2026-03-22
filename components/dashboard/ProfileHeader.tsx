'use client'

import { useState } from 'react'
import { ShoppingBag, Upload } from 'lucide-react'
import Link from 'next/link'
import ShareButton from '@/components/dashboard/ShareButton'
import TierBadge from '@/components/ui/TierBadge'
import ImportModal from '@/components/dashboard/ImportModal'
import { Profile } from '@/lib/supabase/profile'
import { useTranslation } from '@/lib/i18n/context'
import NotificationCenter from '@/components/dashboard/NotificationCenter'

interface ProfileHeaderProps {
  user: {
    id: string
    email?: string
  }
  profile: Profile | null
  itemCount: number
  totalValue: number
  onRefreshPrices: () => void | Promise<void>
  refreshing: boolean
}

export default function ProfileHeader({ user, profile, itemCount, totalValue, onRefreshPrices, refreshing }: ProfileHeaderProps) {
  const { t } = useTranslation()
  const [showImport, setShowImport] = useState(false)
  const displayName = profile?.full_name || 'Curator'
  const username = profile?.username || 'username'
  const avatarUrl = profile?.avatar_url || `https://avatar.vercel.sh/${user.id}`
  const bannerUrl = (profile as any)?.banner_url || null
  const clampPct = (v: unknown) => {
    const n = Math.round(Number(v))
    if (!Number.isFinite(n)) return 50
    return Math.min(100, Math.max(0, n))
  }
  const bannerPosX = clampPct(profile?.banner_position_x)
  const bannerPosY = clampPct(profile?.banner_position_y)

  return (
    <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-2">
      {/* Banner */}
      <div className="relative w-full h-36 sm:h-40 md:h-44 rounded-2xl overflow-hidden">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: `${bannerPosX}% ${bannerPosY}%` }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-violet-200 via-purple-100 to-pink-100 dark:from-violet-950 dark:via-purple-950 dark:to-dpurple-900" />
        )}

        {/* Action buttons pinned inside the banner (top-right) */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          <button
            onClick={() => setShowImport(true)}
            className="rounded-full p-2 shadow-sm border bg-white/80 dark:bg-dpurple-900/80 backdrop-blur-sm text-zinc-500 dark:text-zinc-400 border-white/60 dark:border-dpurple-600 hover:text-violet-600 dark:hover:text-violet-400 transition-all"
            title={t('Import from spreadsheet or Amazon')}
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <ShareButton />
          <div className="max-md:hidden">
            <NotificationCenter />
          </div>
        </div>
      </div>

      {/* Avatar — overlaps the banner bottom edge */}
      <div className="relative z-10 -mt-10 sm:-mt-12 ml-4 sm:ml-6">
        <div className="h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 rounded-full border-4 border-beige-50 dark:border-dpurple-950 shadow-lg overflow-hidden ring-2 ring-violet-100 dark:ring-violet-900">
          <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Name / username / bio + desktop stats */}
      <div className="mt-3 px-1 sm:px-2 flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
        {/* Identity block */}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate flex flex-wrap items-center gap-2">
            {displayName}
            <TierBadge tier={profile?.subscription_tier} />
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">@{username}</p>
          {profile?.bio ? (
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed line-clamp-2 pt-0.5">
              {profile.bio}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 max-w-sm leading-relaxed italic pt-0.5 hidden sm:block">
              No bio yet. Add one in settings.
            </p>
          )}
        </div>

        {/* Desktop stats */}
        <div className="hidden sm:flex flex-shrink-0 items-center gap-5 text-center pt-1">
          <div>
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">{t('Value')}</div>
          </div>
          <Link href="/dashboard/purchased" className="group">
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 transition-colors flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-green-600 transition-colors">{t('Purchased')}</div>
          </Link>
        </div>
      </div>

      {/* Mobile stats row */}
      <div className="flex sm:hidden gap-5 mt-4 px-1 text-center">
        <div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">{t('Value')}</div>
        </div>
        <div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{itemCount}</div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">{t('Items')}</div>
        </div>
        <Link href="/dashboard/purchased" className="group">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 transition-colors flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-green-600 transition-colors">{t('Purchased')}</div>
        </Link>
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onComplete={() => {
          setShowImport(false)
          window.location.reload()
        }}
      />
    </div>
  )
}
