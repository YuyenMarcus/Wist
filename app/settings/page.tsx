'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Check, Instagram, Link as LinkIcon, ShoppingCart, Video, Shield, Lock, ArrowLeft, Zap, Palette, Gift, DollarSign, Moon, Sun } from 'lucide-react'
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
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [profile, setProfile] = useState<any>(null)
  
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
        amazon_affiliate_id: formData.amazonId.trim() || null,
        adult_content_filter: isMinor ? true : formData.adultFilter,
        auto_activate_queued: formData.autoActivate,
        profile_theme: formData.profileTheme,
        gifting_enabled: formData.giftingEnabled,
        gifting_message: formData.giftingMessage.trim() || null,
        preferred_currency: formData.preferredCurrency,
      })

      if (error) {
        // Check for username change lock
        if (error.code === 'USERNAME_CHANGE_LOCKED') {
          setMessage({ type: 'error', text: error.message || 'Username can only be changed once every 30 days.' })
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
    <PageTransition className="min-h-screen bg-zinc-50 dark:bg-dpurple-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-dpurple-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Profile Settings</h1>
        </div>

        <form onSubmit={handleUpdate} className="space-y-8">
          
          {/* --- SECTION 1: BASIC INFO --- */}
          <div className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2">Basic Info</h2>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Display Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-zinc-200 dark:border-dpurple-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900 dark:text-zinc-100 bg-beige-50 dark:bg-dpurple-800"
                placeholder="Enter your full name"
              />
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
          </div>

          {/* --- SECTION 2: CREATOR & SOCIAL --- */}
          <div id="creator" className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
              Creator Links <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">Monetization</span>
            </h2>

            {/* Social Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
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

            {/* Amazon Affiliate - The Money Maker */}
            <div className="bg-violet-50 dark:bg-violet-950/30 p-4 rounded-xl border border-violet-200 dark:border-violet-800">
              <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                <ShoppingCart size={14} /> Amazon Associate Store ID
              </label>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                Enter your ID (e.g., <code className="bg-beige-50 px-1.5 py-0.5 rounded text-violet-700 font-mono">sarah-20</code>). We will automatically replace our links with yours on your profile so you keep 100% of commissions.
              </p>
              <input
                type="text"
                value={formData.amazonId}
                onChange={(e) => setFormData({ ...formData, amazonId: e.target.value })}
                placeholder="tag-20"
                className="w-full px-4 py-2 border border-violet-300 dark:border-violet-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none bg-beige-50 dark:bg-dpurple-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
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
              <Palette size={16} /> Profile Theme
            </h2>

            {!isTierAtLeast(profile?.subscription_tier, 'creator') ? (
              <div className="text-center py-4 space-y-2">
                <Lock size={24} className="text-zinc-300 mx-auto" />
                <p className="text-sm text-zinc-500">Upgrade to <span className="font-semibold text-violet-600">Wist Creator</span> to customize your profile theme</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {THEME_KEYS.map(key => {
                  const theme = PROFILE_THEMES[key]
                  const selected = formData.profileTheme === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, profileTheme: key }))}
                      className={`relative rounded-xl p-3 text-center transition-all border-2 ${
                        selected ? 'border-violet-500 ring-2 ring-violet-200' : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className={`w-full h-8 rounded-lg ${theme.bg} mb-2 border border-zinc-100`} />
                      <div className={`w-full h-1 rounded bg-gradient-to-r ${theme.avatarGradient} mb-2`} />
                      <span className="text-xs font-medium text-zinc-700">{theme.name}</span>
                      {selected && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* --- SECTION 5: GIFTING (Pro+) --- */}
          <div id="gifting" className="bg-beige-100 dark:bg-dpurple-900 p-8 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm space-y-6 scroll-mt-20">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-dpurple-700 pb-2 flex items-center gap-2">
              <Gift size={16} /> Gifting
            </h2>

            {!isTierAtLeast(profile?.subscription_tier, 'pro_plus') ? (
              <div className="text-center py-4 space-y-2">
                <Lock size={24} className="text-zinc-300 mx-auto" />
                <p className="text-sm text-zinc-500">Upgrade to <span className="font-semibold text-violet-600">Wist Pro</span> to enable gifting on your profile</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <label className="block text-sm font-medium text-zinc-700 flex items-center gap-2">
                      <Gift size={14} /> Enable Gifting
                    </label>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Allow visitors to see a &quot;Gift this item&quot; button on your public profile items.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, giftingEnabled: !prev.giftingEnabled }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      formData.giftingEnabled ? 'bg-violet-600' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        formData.giftingEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {formData.giftingEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Thank-you Message</label>
                    <textarea
                      value={formData.giftingMessage}
                      onChange={e => setFormData(prev => ({ ...prev, giftingMessage: e.target.value }))}
                      placeholder="Thank you for the gift! 💜"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
                      rows={2}
                      maxLength={200}
                    />
                    <p className="text-xs text-zinc-400 mt-1">{formData.giftingMessage.length}/200</p>
                  </div>
                )}
              </>
            )}
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
            className="w-full bg-violet-600 text-white font-semibold py-4 rounded-xl hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-violet-200"
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
