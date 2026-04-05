'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, Check, Instagram, Facebook, Link as LinkIcon, ShoppingCart, Video, Shield, Lock, ArrowLeft, Zap, Palette, Gift, DollarSign, Moon, Sun, Camera, X as XIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getProfile, updateProfile } from '@/lib/supabase/profile'
import { PROFILE_THEMES, THEME_KEYS } from '@/lib/constants/profile-themes'
import { isTierAtLeast } from '@/lib/tier-guards'
import { CURRENCY_INFO, SUPPORTED_CURRENCIES } from '@/lib/currency'
import LavenderLoader from '@/components/ui/LavenderLoader'
import PageTransition from '@/components/ui/PageTransition'
import { useDarkMode } from '@/lib/hooks/useDarkMode'
import { useTranslation } from '@/lib/i18n/context'

function AppearanceSection() {
  const { isDark, toggle } = useDarkMode()
  const { locale, setLocale, t } = useTranslation()
  return (
    <div className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
        {isDark ? <Moon size={16} /> : <Sun size={16} />} {t('Appearance')}
      </h2>
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('Dark Mode')}</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t('Switch the dashboard and settings to a dark theme.')}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            isDark ? 'bg-violet-600' : 'bg-zinc-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              isDark ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('Language')}</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t('Choose your preferred language for the interface.')}
          </p>
        </div>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as 'en' | 'es')}
          className="w-36 px-3 py-2 border border-zinc-300 dark:border-dpurple-600 rounded-lg text-sm bg-beige-50 dark:bg-dpurple-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent flex-shrink-0"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [profile, setProfile] = useState<any>(null)
  
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [bannerPos, setBannerPos] = useState({ x: 50, y: 50 })
  const bannerPosSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [messengerBusy, setMessengerBusy] = useState(false)

  // Expanded Form State
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    fullName: '',
    website: '',
    instagram: '',
    tiktok: '',
    amazonId: '',
    adultFilter: true,
    autoActivate: true,
    profileTheme: 'default',
    giftingEnabled: false,
    giftingMessage: '',
    preferredCurrency: 'USD',
  })

  // 1. Load All Profile Data
  useEffect(() => {
    const getProfileData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data, error } = await getProfile(user.id)
        
        if (error) throw error

        if (data) {
          setProfile(data)
          setBannerUrl(data.banner_url || null)
          const bx = typeof data.banner_position_x === 'number' ? data.banner_position_x : 50
          const by = typeof data.banner_position_y === 'number' ? data.banner_position_y : 50
          setBannerPos({
            x: Math.min(100, Math.max(0, bx)),
            y: Math.min(100, Math.max(0, by)),
          })
          setFormData({
            username: data.username || '',
            bio: data.bio || '',
            fullName: data.full_name || '',
            website: data.website || '',
            instagram: data.instagram_handle || '',
            tiktok: data.tiktok_handle || '',
            amazonId: data.amazon_affiliate_id || '',
            adultFilter: data.adult_content_filter ?? true,
            autoActivate: data.auto_activate_queued ?? true,
            profileTheme: data.profile_theme || 'default',
            giftingEnabled: data.gifting_enabled ?? false,
            giftingMessage: data.gifting_message || '',
            preferredCurrency: data.preferred_currency || 'USD',
          })
        }
      } catch (error: any) {
        console.error('Error loading profile:', error)
        setMessage({ type: 'error', text: 'Failed to load profile. Please try again.' })
      } finally {
        setLoading(false)
      }
    }
    getProfileData()
  }, [router])

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Banner image must be under 5MB.' })
      return
    }

    setUploadingBanner(true)
    try {
      const ext = file.name.split('.').pop()
      const filePath = `${user.id}/banner-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await updateProfile(user.id, { banner_url: publicUrl })
      if (updateError) throw updateError

      setBannerUrl(publicUrl)
      setMessage({ type: 'success', text: 'Cover image updated!' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    } catch (err: any) {
      console.error('Banner upload error:', err)
      setMessage({ type: 'error', text: err.message || 'Failed to upload cover image.' })
    } finally {
      setUploadingBanner(false)
    }
  }

  async function handleBannerRemove() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUploadingBanner(true)
    try {
      const { error } = await updateProfile(user.id, { banner_url: null })
      if (error) throw error
      setBannerUrl(null)
      setMessage({ type: 'success', text: 'Cover image removed.' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to remove cover image.' })
    } finally {
      setUploadingBanner(false)
    }
  }

  const scheduleSaveBannerPosition = useCallback((x: number, y: number) => {
    if (bannerPosSaveTimer.current) clearTimeout(bannerPosSaveTimer.current)
    bannerPosSaveTimer.current = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: updated, error } = await updateProfile(user.id, {
        banner_position_x: x,
        banner_position_y: y,
      })
      if (error) {
        console.error('Banner position save:', error)
        return
      }
      if (updated) setProfile(updated)
    }, 450)
  }, [])

  const updateBannerPos = useCallback(
    (patch: Partial<{ x: number; y: number }>) => {
      setBannerPos((p) => {
        const n = {
          x: Math.min(100, Math.max(0, patch.x !== undefined ? patch.x : p.x)),
          y: Math.min(100, Math.max(0, patch.y !== undefined ? patch.y : p.y)),
        }
        scheduleSaveBannerPosition(n.x, n.y)
        return n
      })
    },
    [scheduleSaveBannerPosition]
  )

  async function generateMessengerLinkCode() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setMessengerBusy(true)
    setMessage({ type: '', text: '' })
    try {
      const bytes = new Uint8Array(4)
      crypto.getRandomValues(bytes)
      const code = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      const { data, error } = await updateProfile(user.id, { messenger_link_token: code })
      if (error) throw error
      if (data) setProfile(data)
      setMessage({
        type: 'success',
        text: 'Link code ready. Send it from Facebook Messenger as shown below.',
      })
      setTimeout(() => setMessage({ type: '', text: '' }), 5000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Could not generate code.' })
    } finally {
      setMessengerBusy(false)
    }
  }

  async function disconnectMessenger() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setMessengerBusy(true)
    setMessage({ type: '', text: '' })
    try {
      const { data, error } = await updateProfile(user.id, {
        messenger_psid: null,
        messenger_link_token: null,
      })
      if (error) throw error
      if (data) setProfile(data)
      setMessage({ type: 'success', text: 'Facebook Messenger disconnected.' })
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Could not disconnect.' })
    } finally {
      setMessengerBusy(false)
    }
  }

  // 2. Handle Update
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage({ type: 'error', text: 'Not authenticated. Please log in.' })
      setSaving(false)
      return
    }

    try {
      // Clean handles (remove '@' if user added it)
      const cleanInsta = formData.instagram.replace(/^@+/, '').trim()
      const cleanTikTok = formData.tiktok.replace(/^@+/, '').trim()

      const isMinor = profile?.age != null && profile.age < 18
      const { data, error } = await updateProfile(user.id, {
        username: formData.username.trim() || null,
        full_name: formData.fullName.trim() || null,
        bio: formData.bio.trim() || null,
        website: formData.website.trim() || null,
        instagram_handle: cleanInsta || null,
        tiktok_handle: cleanTikTok || null,
        amazon_affiliate_id: isTierAtLeast(profile?.subscription_tier, 'pro')
          ? formData.amazonId.trim() || null
          : null,
        adult_content_filter: isMinor ? true : formData.adultFilter,
        auto_activate_queued: formData.autoActivate,
        profile_theme: formData.profileTheme,
        gifting_enabled: formData.giftingEnabled,
        gifting_message: formData.giftingMessage.trim() || null,
        preferred_currency: formData.preferredCurrency,
      })

      if (error) {
        if (error.code === 'USERNAME_CHANGE_LOCKED' || error.code === 'NAME_CHANGE_LOCKED') {
          setMessage({ type: 'error', text: error.message })
          setSaving(false)
          return
        }
        throw error
      }

      // Update local state to show cleaned versions
      setFormData(prev => ({ ...prev, instagram: cleanInsta, tiktok: cleanTikTok }))
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      
    } catch (error: any) {
      if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
        setMessage({ type: 'error', text: 'This username is already taken. Please choose another.' })
      } else {
        setMessage({ type: 'error', text: error.message || 'Error updating profile. Please try again.' })
      }
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-zinc-50 dark:bg-dpurple-950">
        <LavenderLoader size="lg" />
      </div>
    )
  }

  return (
    <PageTransition className="min-h-screen bg-zinc-50 dark:bg-dpurple-950 pt-20 pb-16 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-dpurple-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t('Profile Settings')}</h1>
        </div>

        {/* Subscription Link */}
        <Link
          href="/dashboard/subscription"
          className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/40 border border-violet-200 dark:border-violet-800/60 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Manage Subscription</span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">View plans, billing & payment method</p>
            </div>
          </div>
          <ArrowLeft className="w-4 h-4 text-zinc-400 rotate-180 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <form onSubmit={handleUpdate} className="space-y-8">
          
          {/* --- SECTION 1: BASIC INFO --- */}
          <div className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2">Basic Info</h2>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Display Name</label>
              {(() => {
                const nameChanged = profile?.name_changed_at;
                let nameDaysRemaining = 0;
                let nameCanChange = true;
                if (nameChanged) {
                  const lastChanged = new Date(nameChanged);
                  const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                  nameDaysRemaining = Math.ceil(30 - daysSince);
                  nameCanChange = daysSince >= 30;
                }
                const nameIsLocked = !nameCanChange && formData.fullName !== (profile?.full_name || '');
                return (
                  <>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => {
                        if (nameCanChange) setFormData({ ...formData, fullName: e.target.value });
                      }}
                      readOnly={!nameCanChange}
                      className={`w-full px-4 py-2 border rounded-lg outline-none transition text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800 ${
                        !nameCanChange
                          ? 'border-zinc-200 dark:border-dpurple-700 opacity-60 cursor-not-allowed'
                          : 'border-zinc-200 dark:border-dpurple-600 focus:ring-2 focus:ring-violet-500 focus:border-violet-500'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {!nameCanChange && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-800/40">
                        Display name can only be changed once every 30 days. You can change it again in {nameDaysRemaining} day{nameDaysRemaining !== 1 ? 's' : ''}.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Username</label>
              {(() => {
                const isLocked = profile?.username_changed_at && profile.username_changed_at !== null;
                let daysRemaining = 0;
                if (isLocked) {
                  const lastChanged = new Date(profile.username_changed_at);
                  const now = new Date();
                  const daysSinceChange = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                  daysRemaining = Math.ceil(30 - daysSinceChange);
                }
                const canChange = !isLocked || daysRemaining <= 0;
                const currentUsername = profile?.username || '';
                const isChanging = formData.username !== currentUsername;
                
                return (
                  <>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-500">@</span>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '').replace(/[^a-zA-Z0-9_]/g, '') })}
                        disabled={!canChange && !isChanging}
                        className={`w-full pl-8 pr-4 py-2 border border-zinc-200 dark:border-dpurple-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800 ${
                          !canChange && !isChanging ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                        placeholder="username"
                        required
                        minLength={3}
                        pattern="^[a-zA-Z0-9_]+$"
                      />
                    </div>
                    {!canChange && !isChanging && (
                      <p className="text-xs text-amber-600 mt-1 bg-amber-50 p-2 rounded border border-amber-200">
                        Username can only be changed once every 30 days. You can change it again in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
                      </p>
                    )}
                    {canChange && (
                      <p className="text-xs text-zinc-500 mt-1">
                        This will be your URL: wist.app/{formData.username || 'username'}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => {
                  if (e.target.value.length <= 160) {
                    setFormData({ ...formData, bio: e.target.value })
                  }
                }}
                className="w-full px-4 py-2 border border-zinc-200 dark:border-dpurple-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition resize-none text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800"
                rows={3}
                placeholder="Tell us a bit about yourself..."
                maxLength={160}
              />
              <div className="text-right text-xs text-zinc-400 mt-1">
                {formData.bio.length}/160
              </div>
            </div>

            {/* Cover Image */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                <Camera size={14} /> Cover Image
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                This banner appears at the top of your dashboard profile. Recommended size: 1200 x 300px. Max 5MB.
              </p>
              <div className="relative w-full h-28 sm:h-36 rounded-xl overflow-hidden border border-zinc-200 dark:border-dpurple-600">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt="Cover"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%` }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-violet-200 via-purple-100 to-pink-100 dark:from-violet-950 dark:via-purple-950 dark:to-dpurple-900" />
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 hover:bg-black/30 transition-colors group">
                  <label className="cursor-pointer p-2 rounded-lg bg-white/80 dark:bg-black/60 text-zinc-700 dark:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white dark:hover:bg-black/80">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleBannerUpload}
                      disabled={uploadingBanner}
                      className="hidden"
                    />
                  </label>
                  {bannerUrl && (
                    <button
                      type="button"
                      onClick={handleBannerRemove}
                      disabled={uploadingBanner}
                      className="p-2 rounded-lg bg-white/80 dark:bg-black/60 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white dark:hover:bg-black/80"
                    >
                      <XIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {uploadingBanner && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              {bannerUrl && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Banner position</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Choose which part of the image stays visible in the cropped header (saved automatically).
                  </p>
                  <div>
                    <div className="flex justify-between text-[10px] uppercase tracking-wide text-zinc-400 mb-1">
                      <span>Left</span>
                      <span>Horizontal</span>
                      <span>Right</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={bannerPos.x}
                      onChange={(e) => updateBannerPos({ x: Number(e.target.value) })}
                      className="w-full h-2 accent-violet-600 bg-zinc-200 dark:bg-dpurple-700 rounded-lg appearance-none cursor-pointer"
                      aria-label="Banner horizontal position"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] uppercase tracking-wide text-zinc-400 mb-1">
                      <span>Top</span>
                      <span>Vertical</span>
                      <span>Bottom</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={bannerPos.y}
                      onChange={(e) => updateBannerPos({ y: Number(e.target.value) })}
                      className="w-full h-2 accent-violet-600 bg-zinc-200 dark:bg-dpurple-700 rounded-lg appearance-none cursor-pointer"
                      aria-label="Banner vertical position"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* --- SECTION 2: CREATOR & SOCIAL --- */}
          <div id="creator" className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
              Creator Links <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">Monetization</span>
            </h2>

            {/* Social Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <Instagram size={14} /> Instagram Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-500">@</span>
                  <input
                    type="text"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-2 border border-zinc-200 dark:border-dpurple-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800"
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">We'll remove the @ when saving</p>
                <div className="mt-3 p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Save links via Instagram (paper plane)</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                    The usual flow: tap the <strong className="text-zinc-800 dark:text-zinc-200">share</strong> button (paper plane) on a post, reel, or ad and send it to our Instagram account — no need to copy a link.
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">One-time setup after you save your handle above:</p>
                  <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
                    <li>Open our Instagram profile and tap <strong className="text-zinc-800 dark:text-zinc-200">Follow</strong> (required).</li>
                    <li>Message us <strong className="text-zinc-800 dark:text-zinc-200">connect</strong> or <strong className="text-zinc-800 dark:text-zinc-200">confirm</strong> to link this Instagram to Wist.</li>
                    <li>After that, share anything to us with the paper plane — we’ll queue it in your Wist dashboard.</li>
                  </ol>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <Facebook size={14} /> Facebook Messenger
                </label>
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-3">
                  {profile?.messenger_psid ? (
                    <>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Check size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                        Messenger is linked to this Wist account
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Send product links in a chat with our Facebook Page and we’ll add them to your wishlist (same as Instagram DM).
                      </p>
                      <button
                        type="button"
                        onClick={disconnectMessenger}
                        disabled={messengerBusy}
                        className="text-sm px-4 py-2 rounded-lg border border-zinc-300 dark:border-dpurple-600 text-zinc-700 dark:text-zinc-200 hover:bg-white/80 dark:hover:bg-dpurple-800 disabled:opacity-50"
                      >
                        {messengerBusy ? 'Working…' : 'Disconnect Messenger'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        Link your <strong className="text-zinc-900 dark:text-zinc-100">Facebook Messenger</strong> chat to Wist using a one-time code.
                      </p>
                      {profile?.messenger_link_token ? (
                        <div className="rounded-lg bg-white dark:bg-dpurple-900/80 border border-blue-200 dark:border-blue-800 p-3 font-mono text-lg tracking-wider text-center text-zinc-900 dark:text-zinc-100">
                          {profile.messenger_link_token}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Generate a code, then message our Facebook Page from the account you use in Messenger.
                        </p>
                      )}
                      <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
                        <li>Open <strong className="text-zinc-800 dark:text-zinc-200">Facebook Messenger</strong> and start a chat with our Page.</li>
                        <li>Click <strong className="text-zinc-800 dark:text-zinc-200">Generate link code</strong> below (or use the code already shown).</li>
                        <li>Send exactly: <code className="bg-beige-100 dark:bg-dpurple-800 px-1 rounded">connect</code> followed by a space and your code, e.g. <code className="bg-beige-100 dark:bg-dpurple-800 px-1 rounded">connect abcdef12</code></li>
                      </ol>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={generateMessengerLinkCode}
                          disabled={messengerBusy}
                          className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {messengerBusy ? 'Working…' : profile?.messenger_link_token ? 'New code' : 'Generate link code'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                  <Video size={14} /> TikTok Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-500">@</span>
                  <input
                    type="text"
                    value={formData.tiktok}
                    onChange={(e) => setFormData({ ...formData, tiktok: e.target.value })}
                    placeholder="username"
                    className="w-full pl-8 pr-4 py-2 border border-zinc-200 dark:border-dpurple-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800"
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">We'll remove the @ when saving</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                <LinkIcon size={14} /> Website / Blog
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://mysite.com"
                className="w-full px-4 py-2 border border-zinc-200 dark:border-dpurple-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800"
              />
            </div>

            {/* Amazon Associate ID — Pro+ (same gating as affiliate links on wishlist) */}
            {!isTierAtLeast(profile?.subscription_tier, 'pro') ? (
              <div className="bg-violet-50 dark:bg-violet-950/30 p-4 rounded-xl border border-violet-200 dark:border-violet-800 text-center space-y-3">
                <Lock size={24} className="text-violet-300 dark:text-violet-600 mx-auto" />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('Upgrade to Wist Pro to add your Amazon Associate Store ID')}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  {t('Your tag is used on Amazon links from your public wishlist so you earn commissions.')}
                </p>
                <Link
                  href="/dashboard/subscription"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 shadow-sm transition-colors"
                >
                  {t('View plans & upgrade')}
                </Link>
              </div>
            ) : (
              <div className="bg-violet-50 dark:bg-violet-950/30 p-4 rounded-xl border border-violet-200 dark:border-violet-800">
                <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                  <ShoppingCart size={14} /> Amazon Associate Store ID
                </label>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                  Enter your ID (e.g., <code className="bg-beige-50 dark:bg-dpurple-800 px-1.5 py-0.5 rounded text-violet-700 font-mono">sarah-20</code>). We will automatically replace our links with yours on your profile so you keep 100% of commissions.
                </p>
                <input
                  type="text"
                  value={formData.amazonId}
                  onChange={(e) => setFormData({ ...formData, amazonId: e.target.value })}
                  placeholder="tag-20"
                  className="w-full px-4 py-2 border border-violet-300 dark:border-violet-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-beige-50 dark:bg-dpurple-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            )}
          </div>

          {/* --- SECTION 3: CONTENT PREFERENCES --- */}
          <div id="content" className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
              <Shield size={16} /> Content Preferences
            </h2>

            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Adult Content Filter</label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {profile?.age != null && profile.age < 18
                    ? 'Adult content is blocked for users under 18.'
                    : 'When enabled, adult items will have their images blurred with an 18+ overlay.'}
                </p>
              </div>
              <div className="relative">
                {profile?.age != null && profile.age < 18 ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Lock size={14} />
                    <span className="font-medium">Always on</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, adultFilter: !prev.adultFilter }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      formData.adultFilter ? 'bg-violet-600' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        formData.adultFilter ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-zinc-100 dark:border-dpurple-700" />

            {/* Auto-activate queued items */}
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <Zap size={14} /> Auto-activate Queued Items
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  When on, queued items are automatically scraped and activated when you open Wist on desktop with the extension. Turn off to manually activate each item.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, autoActivate: !prev.autoActivate }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  formData.autoActivate ? 'bg-violet-600' : 'bg-zinc-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    formData.autoActivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* --- SECTION: APPEARANCE --- */}
          <AppearanceSection />

          {/* --- SECTION: CURRENCY --- */}
          <div className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
              <DollarSign size={16} /> Currency
            </h2>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Display Currency
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                Prices from foreign stores will be converted to your preferred currency. Original prices are always preserved.
              </p>
              <select
                value={formData.preferredCurrency}
                onChange={(e) => setFormData(prev => ({ ...prev, preferredCurrency: e.target.value }))}
                className="w-full sm:w-64 px-3 py-2 border border-zinc-300 dark:border-dpurple-600 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-beige-50 dark:bg-dpurple-800 text-zinc-900 dark:text-zinc-100"
              >
                {SUPPORTED_CURRENCIES.map(code => {
                  const info = CURRENCY_INFO[code]
                  return (
                    <option key={code} value={code}>
                      {info?.symbol} {code} — {info?.name}
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          {/* --- SECTION 4: PROFILE THEME (Creator+) --- */}
          <div id="theme" className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
              <Palette size={16} /> Shared Profile Theme
            </h2>

            {!isTierAtLeast(profile?.subscription_tier, 'creator') ? (
              <div className="text-center py-4 space-y-2">
                <Lock size={24} className="text-zinc-300 mx-auto" />
                <p className="text-sm text-zinc-500">Upgrade to <span className="font-semibold text-violet-600">Wist Creator</span> to customize your profile theme</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEME_KEYS.map(key => {
                  const t = PROFILE_THEMES[key]
                  const selected = formData.profileTheme === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, profileTheme: key }))}
                      className={`relative rounded-xl overflow-hidden text-left transition-all border-2 ${
                        selected ? 'border-violet-500 ring-2 ring-violet-200 dark:ring-violet-800' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <div className={`${t.bg} p-3 pb-4`}>
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${t.avatarGradient} flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className={`h-2 w-12 rounded ${t.isDark ? 'bg-white/30' : 'bg-zinc-900/15'}`} />
                            <div className={`h-1.5 w-8 rounded mt-1 ${t.isDark ? 'bg-white/15' : 'bg-zinc-900/8'}`} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className={`${t.cardBg} rounded-md border ${t.borderColor} p-1.5`}>
                            <div className={`w-full aspect-square rounded bg-gradient-to-br ${t.avatarGradient} opacity-20 mb-1`} />
                            <div className={`h-1.5 w-10 rounded ${t.isDark ? 'bg-white/20' : 'bg-zinc-900/10'}`} />
                            <div className={`h-1.5 w-6 rounded mt-0.5 ${t.accent.replace('text-', 'bg-')} opacity-30`} />
                          </div>
                          <div className={`${t.cardBg} rounded-md border ${t.borderColor} p-1.5`}>
                            <div className={`w-full aspect-square rounded bg-gradient-to-br ${t.avatarGradient} opacity-20 mb-1`} />
                            <div className={`h-1.5 w-8 rounded ${t.isDark ? 'bg-white/20' : 'bg-zinc-900/10'}`} />
                            <div className={`h-1.5 w-5 rounded mt-0.5 ${t.accent.replace('text-', 'bg-')} opacity-30`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-dpurple-800">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t.name}</span>
                        {selected && (
                          <div className="w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
                            <Check size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* --- SECTION 5: GIFTING (coming soon) --- */}
          <div id="gifting" className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
              <Gift size={16} /> {t('Gifting')}
            </h2>
            <div className="rounded-xl border border-violet-200/70 dark:border-violet-800/40 bg-violet-50/60 dark:bg-violet-950/25 px-5 py-7 text-center">
              <Gift size={36} strokeWidth={1.25} className="text-violet-500 dark:text-violet-400 mx-auto mb-3 opacity-90" aria-hidden />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                {t('Enable gifting will be available in the next update!')}
              </p>
            </div>
          </div>

          {/* --- FEEDBACK MESSAGE --- */}
          {message.text && (
            <div className={`p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'error' 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          {/* --- SUBMIT --- */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-violet-600 text-white font-semibold py-4 rounded-xl hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-violet-200 mb-24"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Saving Changes...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </form>

      </div>
    </PageTransition>
  )
}
