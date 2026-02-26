'use client'

import { useState } from 'react'
import { ShoppingBag, Upload, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import AddItemForm from '@/components/dashboard/AddItemForm'
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
  onRefreshPrices: () => void | Promise<void>
  refreshing: boolean
}

export default function ProfileHeader({ user, profile, itemCount, onRefreshPrices, refreshing }: ProfileHeaderProps) {
  const { t } = useTranslation()
  const [showImport, setShowImport] = useState(false)
  const displayName = profile?.full_name || 'Curator'
  const username = profile?.username || 'username'
  const avatarUrl = profile?.avatar_url || `https://avatar.vercel.sh/${user.id}`

  return (
    <div className="w-full max-w-2xl mx-auto pt-6 sm:pt-12 pb-6 sm:pb-8 px-4">
      {/* 1. Identity Section - Stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
        <div className="flex gap-4 sm:gap-5">
          {/* Avatar with Ring */}
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-white dark:border-dpurple-900 shadow-lg overflow-hidden ring-2 ring-violet-100 dark:ring-violet-900 flex-shrink-0">
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Text Info */}
          <div className="pt-1 sm:pt-2 min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate flex items-center gap-1.5">
              {displayName}
              <TierBadge tier={profile?.subscription_tier} />
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">@{username}</p>
            {profile?.bio ? (
              <p className="mt-1 sm:mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-xs leading-relaxed line-clamp-2 sm:line-clamp-none">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-zinc-400 dark:text-zinc-500 max-w-xs leading-relaxed italic hidden sm:block">
                No bio yet. Add one in your account settings.
              </p>
            )}
          </div>
        </div>
        
        {/* Stats (Social Proof) - Inline on mobile */}
        <div className="flex gap-6 sm:pt-3 text-center flex-shrink-0 items-center sm:items-start justify-start sm:justify-end">
          <div>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 h-6 sm:h-7 flex items-center justify-center">{itemCount}</div>
            <div className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">{t('Items')}</div>
          </div>
          <Link href="/dashboard/purchased" className="group">
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-green-600 transition-colors h-6 sm:h-7 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-semibold group-hover:text-green-600 transition-colors">{t('Purchased')}</div>
          </Link>
        </div>
      </div>

      {/* Share Button, Import, and Notifications */}
      <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button
          onClick={() => setShowImport(true)}
          className="rounded-full p-2.5 sm:p-3 shadow-sm border bg-beige-100 dark:bg-dpurple-900 text-zinc-400 dark:text-zinc-500 border-beige-200 dark:border-dpurple-600 hover:text-violet-600 dark:hover:text-violet-400 hover:border-violet-200 dark:hover:border-violet-800 transition-all"
          title={t('Import from spreadsheet or Amazon')}
        >
          <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <ShareButton />
        <NotificationCenter />
      </div>

      {/* 2. The "Compose" Area - Your AddItemForm lives here now */}
      <div className="mb-10">
        <AddItemForm />
        <button
          onClick={() => setShowImport(true)}
          className="mt-1.5 mx-auto flex items-center gap-1 text-[10px] text-zinc-300 dark:text-zinc-600 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
        >
          <Upload size={9} />
          {t('Have items elsewhere?')} <span className="underline underline-offset-2">{t('Import them')}</span>
        </button>
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
      
      {/* Horizontal Divider before content */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-200 dark:via-zinc-800 to-transparent mb-8" />
    </div>
  )
}

