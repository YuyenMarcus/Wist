'use client'

import { useState } from 'react'
import { X, User, Loader2, Check, AlertTriangle, Crown, Gem, Building2, Shield } from 'lucide-react'
import { TIERS, TIER_ORDER, type SubscriptionTier } from '@/lib/constants/subscription-tiers'
import type { AdminUser } from './types'
import { formatAdminDate } from './utils'

const TIER_ICONS: Record<string, typeof User> = {
  free: User,
  pro: Gem,
  creator: Crown,
  enterprise: Building2,
}

const TIER_ICON_COLORS: Record<string, string> = {
  free: 'text-zinc-400',
  pro: 'text-violet-500',
  creator: 'text-amber-500',
  enterprise: 'text-emerald-500',
}

const TIER_SELECTOR_ACTIVE: Record<string, string> = {
  free: 'border-zinc-500 bg-zinc-50',
  pro: 'border-violet-500 bg-violet-50',
  creator: 'border-amber-500 bg-amber-50',
  enterprise: 'border-emerald-500 bg-emerald-50',
}

export function EditUserModal({
  user,
  onClose,
  onSave,
  saving,
}: {
  user: AdminUser
  onClose: () => void
  onSave: (id: string, updates: Record<string, unknown>) => void
  saving: boolean
}) {
  const [tier, setTier] = useState(user.subscription_tier || 'free')
  const [banned, setBanned] = useState(user.is_banned)
  const [banReason, setBanReason] = useState(user.ban_reason || '')
  const [adminRole, setAdminRole] = useState(user.is_admin)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Edit user</h2>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-violet-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.full_name || user.username || 'No name'}</p>
            <p className="text-xs text-zinc-400 truncate">{user.email}</p>
          </div>
          <div className="text-right flex-shrink-0 space-y-1">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Joined</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">{formatAdminDate(user.created_at)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 uppercase font-semibold">Last login</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                {user.last_sign_in_at ? formatAdminDate(user.last_sign_in_at) : 'Never'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-500" /> Admin console access
          </label>
          <button
            type="button"
            onClick={() => setAdminRole(!adminRole)}
            className={`relative w-11 h-6 rounded-full transition-colors ${adminRole ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                adminRole ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <p className="text-xs text-zinc-500 -mt-2">
          Password reset: use Supabase Dashboard → Authentication → Users → send recovery email for this address.
        </p>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Subscription plan</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {TIER_ORDER.map((t) => {
              const cfg = TIERS[t]
              const Icon = TIER_ICONS[t] || User
              const isActive = tier === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                    isActive
                      ? TIER_SELECTOR_ACTIVE[t] || 'border-violet-500 bg-violet-50 dark:bg-violet-950/40'
                      : 'border-zinc-200 dark:border-zinc-600 hover:border-zinc-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${TIER_ICON_COLORS[t]}`} />
                  <span className="text-[10px] font-bold leading-tight text-center text-zinc-800 dark:text-zinc-200">
                    {cfg.displayName.replace('Wist ', '')}
                  </span>
                  <span className="text-[9px] text-zinc-400">{cfg.priceLabel}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Ban user
            </label>
            <button
              type="button"
              onClick={() => setBanned(!banned)}
              className={`relative w-11 h-6 rounded-full transition-colors ${banned ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  banned ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {banned && (
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Ban reason"
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none"
            />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave(user.id, {
                subscription_tier: tier,
                is_banned: banned,
                ban_reason: banned ? banReason : null,
                is_admin: adminRole,
              })
            }
            disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
