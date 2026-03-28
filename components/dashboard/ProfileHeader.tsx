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
import TreatYourselfMeter from '@/components/dashboard/TreatYourselfMeter'

interface ProfileHeaderProps {
  user: {
    id: string
    email?: string
  }
  profile: Profile | null
  itemCount: number
  /** Total $ saved from tracked price drops (used for Treat yourself meter). */
  totalSavings: number
  onRefreshPrices: () => void | Promise<void>
  refreshing: boolean
}

export default function ProfileHeader({ user, profile, itemCount, totalSavings, onRefreshPrices, refreshing }: ProfileHeaderProps) {
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
    <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-4">
      {/* Banner — no overlap on mobile so name/username sit fully below the image */}
      <div className="relative w-full h-24 sm:h-32 rounded-xl sm:rounded-2xl overflow-hidden mb-4 md:mb-[-1.75rem]">
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
      </div>

      {/* Profile row — stack on mobile so title isn’t squeezed against the banner */}
      <div className="relative z-10 flex flex-col gap-3 max-md:mt-1 md:flex-row md:items-end md:justify-between md:gap-4 pl-2 sm:pl-4 md:mt-3">
        {/* Avatar + Info */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 md:items-end">
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-full border-4 border-beige-50 dark:border-dpurple-950 shadow-lg overflow-hidden ring-2 ring-violet-100 dark:ring-violet-900">
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 pb-0.5 md:pb-1 pt-0 md:pt-2">
            <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate flex flex-wrap items-center gap-1.5 max-md:leading-snug">
              {displayName}
              <TierBadge tier={profile?.subscription_tier} />
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">@{username}</p>
            {profile?.bio ? (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed line-clamp-2 hidden sm:block">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500 max-w-xs leading-relaxed italic hidden sm:block">
                No bio yet. Add one in settings.
              </p>
            )}
          </div>
        </div>

        {/* Stats + Actions — bell only with desktop header; mobile uses Sidebar MobileHeader bell */}
        <div className="flex flex-shrink-0 items-center justify-end gap-3 sm:gap-5 pb-1 max-md:w-full md:max-w-none">
          <div className="hidden sm:flex gap-5 text-center mr-2 items-start">
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{itemCount}</div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">{t('Items')}</div>
            </div>
            <TreatYourselfMeter variant="inline" savedAmount={totalSavings} />
            <Link href="/dashboard/purchased" className="group">
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 transition-colors flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-green-600 transition-colors">{t('Purchased')}</div>
            </Link>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="rounded-full p-2 sm:p-2.5 shadow-sm border bg-beige-100 dark:bg-dpurple-900 text-zinc-400 dark:text-zinc-500 border-beige-200 dark:border-dpurple-600 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-200 dark:hover:border-violet-800 transition-all"
              title={t('Import from spreadsheet or Amazon')}
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <ShareButton />
            <div className="max-md:hidden">
              <NotificationCenter />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bio */}
      {profile?.bio && (
        <p className="sm:hidden mt-2 pl-2 text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed line-clamp-2">
          {profile.bio}
        </p>
      )}

      {/* Mobile-only stats row */}
      <div className="flex sm:hidden gap-5 mt-3 pl-2 text-center items-start justify-center flex-wrap">
        <div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{itemCount}</div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">{t('Items')}</div>
        </div>
        <TreatYourselfMeter variant="inline" savedAmount={totalSavings} />
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
