'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'
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
    <div className="w-full max-w-2xl mx-auto pt-12 pb-8 px-4">
      {/* 1. Identity Section */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex gap-5">
          {/* Avatar with Ring */}
          <div className="relative h-20 w-20 rounded-full border-4 border-white shadow-lg overflow-hidden ring-2 ring-violet-100 flex-shrink-0">
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Text Info */}
          <div className="pt-2">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              {displayName}
            </h1>
            <p className="text-sm text-zinc-500 font-medium">@{username}</p>
            <p className="mt-2 text-sm text-zinc-600 max-w-xs leading-relaxed">
              Curating the digital artifacts of my life.
            </p>
          </div>
        </div>
        
        {/* Stats (Social Proof) */}
        <div className="flex gap-6 pt-3 text-center flex-shrink-0">
          <div>
            <div className="text-lg font-bold text-zinc-900">{itemCount}</div>
            <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Items</div>
          </div>
        </div>
      </div>

      {/* Share Button and Refresh - Top Right */}
      <div className="flex justify-end gap-3 mb-6">
        <button 
          onClick={onRefreshPrices}
          disabled={refreshing}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all
            ${refreshing 
              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
              : 'bg-white text-zinc-900 hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200 hover:ring-zinc-300'
            }`}
        >
          <span className={refreshing ? "animate-spin" : ""}>↻</span>
          {refreshing ? 'Scanning...' : 'Check Prices'}
        </button>
        <ShareButton />
        <button
          onClick={() => router.push('/account')}
          className="rounded-full bg-white p-3 text-zinc-600 shadow-sm border border-zinc-200 hover:bg-zinc-50 hover:text-violet-600 transition-all"
          title="Account Settings"
        >
          <User size={20} />
        </button>
      </div>

      {/* 2. The "Compose" Area - Your AddItemForm lives here now */}
      <div className="mb-10">
        <AddItemForm />
      </div>

      {/* 3. Filter Tabs (Modern "Pills" look) */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
        {['All Items', 'Tech', 'Fashion', 'Home', 'Books'].map((tab, i) => (
          <motion.button
            key={tab}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              i === 0 
              ? 'bg-zinc-900 text-white shadow-md' 
              : 'bg-white text-zinc-600 border border-zinc-200 hover:border-violet-300 hover:text-violet-600'
            }`}
          >
            {tab}
          </motion.button>
        ))}
      </div>
      
      {/* Horizontal Divider before content */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent mb-8" />
    </div>
  )
}

