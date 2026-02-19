'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { User, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import AddItemForm from '@/components/dashboard/AddItemForm'
import ShareButton from '@/components/dashboard/ShareButton'
import { Profile } from '@/lib/supabase/profile'

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
  const router = useRouter()
  const displayName = profile?.full_name || 'Curator'
  const username = profile?.username || 'username'
  const avatarUrl = profile?.avatar_url || `https://avatar.vercel.sh/${user.id}`

  return (
    <div className="w-full max-w-2xl mx-auto pt-6 sm:pt-12 pb-6 sm:pb-8 px-4">
      {/* 1. Identity Section - Stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
        <div className="flex gap-4 sm:gap-5">
          {/* Avatar with Ring */}
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-white shadow-lg overflow-hidden ring-2 ring-violet-100 flex-shrink-0">
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Text Info */}
          <div className="pt-1 sm:pt-2 min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight truncate">
              {displayName}
            </h1>
            <p className="text-sm text-zinc-500 font-medium">@{username}</p>
            {profile?.bio ? (
              <p className="mt-1 sm:mt-2 text-sm text-zinc-600 max-w-xs leading-relaxed line-clamp-2 sm:line-clamp-none">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-zinc-400 max-w-xs leading-relaxed italic hidden sm:block">
                No bio yet. Add one in your account settings.
              </p>
            )}
          </div>
        </div>
        
        {/* Stats (Social Proof) - Inline on mobile */}
        <div className="flex gap-6 sm:pt-3 text-center flex-shrink-0 items-center sm:items-start justify-start sm:justify-end">
          <div>
            <div className="text-base sm:text-lg font-bold text-zinc-900 h-6 sm:h-7 flex items-center justify-center">{itemCount}</div>
            <div className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider font-semibold">Items</div>
          </div>
          <Link href="/dashboard/purchased" className="group">
            <div className="text-base sm:text-lg font-bold text-zinc-900 group-hover:text-green-600 transition-colors h-6 sm:h-7 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-wider font-semibold group-hover:text-green-600 transition-colors">Purchased</div>
          </Link>
        </div>
      </div>

      {/* Share Button and Refresh - Responsive layout */}
      <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button 
          onClick={onRefreshPrices}
          disabled={refreshing}
          className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm transition-all
            ${refreshing 
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
              : 'bg-white text-zinc-600 hover:bg-violet-50 hover:text-violet-600 ring-1 ring-inset ring-zinc-200 hover:ring-violet-300'
            }`}
        >
          <span className={refreshing ? "animate-spin" : ""}>↻</span>
          <span className="hidden xs:inline">{refreshing ? 'Scanning...' : 'Check Prices'}</span>
          <span className="xs:hidden">{refreshing ? '...' : 'Check'}</span>
        </button>
        <ShareButton />
        <button
          onClick={() => router.push('/account')}
          className="rounded-full bg-white p-2.5 sm:p-3 text-zinc-600 shadow-sm border border-zinc-200 hover:bg-zinc-50 hover:text-violet-600 transition-all"
          title="Account Settings"
        >
          <User size={18} className="sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* 2. The "Compose" Area - Your AddItemForm lives here now */}
      <div className="mb-10">
        <AddItemForm />
      </div>
      
      {/* Horizontal Divider before content */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent mb-8" />
    </div>
  )
}

