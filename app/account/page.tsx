'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, X, LogOut, ArrowLeft, ChevronRight, Shield, User, Link as LinkIcon, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getProfile, updateProfile, Profile } from '@/lib/supabase/profile'
import { useUsername } from '@/hooks/useUsername'
import LavenderLoader from '@/components/ui/LavenderLoader'

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  
  // Form state
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [currentUsername, setCurrentUsername] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const BIO_MAX_LENGTH = 150
  
  // Username validation hook
  const { 
    username, 
    setUsername, 
    isAvailable, 
    isValid, 
    loading: checkingUsername, 
    error: usernameError 
  } = useUsername(currentUsername)

  // Fetch current user and profile
  useEffect(() => {
    async function loadUserAndProfile() {
      try {
        setLoading(true)
        setError(null)

        // Get current user
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        
        if (userError) throw userError
        if (!currentUser) {
          setError('Not authenticated. Please log in.')
          setLoading(false)
          return
        }

        setUser(currentUser)

        // Fetch profile
        const { data: profileData, error: profileError } = await getProfile(currentUser.id)
        
        if (profileError) throw profileError
        
        setProfile(profileData)
        setFullName(profileData?.full_name || '')
        setBio(profileData?.bio || '')
        setAvatarUrl(profileData?.avatar_url || null)
        const existingUsername = profileData?.username || ''
        setCurrentUsername(existingUsername)
        setUsername(existingUsername)
      } catch (err: any) {
        console.error('Error loading profile:', err)
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadUserAndProfile()
  }, [])

  // Handle avatar upload
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) {
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    try {
      setUploading(true)
      setError(null)
      setSuccess(false)

      // Create unique file path
      const fileExt = file.name.split('.').pop() || 'png'
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const { data, error: updateError } = await updateProfile(user.id, {
        avatar_url: publicUrl,
      })

      if (updateError) throw updateError

      setProfile(data)
      setAvatarUrl(publicUrl)
      setSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error uploading avatar:', err)
      setError(err.message || 'Failed to upload avatar')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Handle form submission
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    
    if (!user) {
      setError('Not authenticated')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      // Final validation before submitting
      if (username !== currentUsername && !isValid) {
        setError('Please fix username errors before saving')
        return
      }

      const { data, error: updateError } = await updateProfile(user.id, {
        full_name: fullName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
      })

      if (updateError) {
        // Check for username change lock
        if (updateError.code === 'USERNAME_CHANGE_LOCKED') {
          setError(updateError.message || 'Username can only be changed once every 30 days.')
        } else if (updateError.code === '23505' || updateError.message.includes('unique')) {
          setError('Username is already taken. Please choose another.')
        } else {
          throw updateError
        }
        return
      }

      setProfile(data)
      setCurrentUsername(username.trim())
      setSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dpurple-950">
        <LavenderLoader size="lg" />
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-dpurple-950">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <a href="/login" className="mt-4 text-violet-600 dark:text-violet-400 hover:underline">
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-dpurple-950 py-20 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100 mb-12 text-center"
        >
          Account Settings
        </motion.h1>

        <div className="bg-white dark:bg-dpurple-900 rounded-2xl border border-zinc-200 dark:border-dpurple-700 shadow-sm p-8">
          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-lg bg-green-50 dark:bg-green-950/30 p-4 border border-green-200 dark:border-green-800"
            >
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Profile updated successfully!
              </p>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-lg bg-red-50 dark:bg-red-950/30 p-4 border border-red-200 dark:border-red-800"
            >
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
            </motion.div>
          )}

          {/* Avatar Upload Section */}
          <div className="mb-8">
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-4 text-center">
              Profile Picture
            </label>
            <div className="flex justify-center">
              <div className="relative group">
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-100 dark:bg-dpurple-800 border-4 border-white dark:border-dpurple-700 shadow-lg">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-16 h-16 text-zinc-400 dark:text-zinc-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-violet-500/0 group-hover:bg-violet-500/80 transition-colors duration-300 flex items-center justify-center cursor-pointer">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      id="avatar-upload"
                    />
                    {uploading ? (
                      <div className="text-white text-sm font-medium">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Uploading...
                      </div>
                    ) : (
                      <svg
                        className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="mb-8 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              <span className="font-medium">Email:</span> {profile?.email || user?.email || 'N/A'}
            </p>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSave}>
            <div className="mb-6">
              <label htmlFor="full_name" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-dpurple-700 bg-white dark:bg-dpurple-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-sm focus:border-violet-300 dark:focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-800 transition-colors"
                placeholder="Enter your full name"
              />
            </div>

            {/* Username Input */}
            <div className="mb-6">
              <label htmlFor="username" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                Username
              </label>
              {(() => {
                const usernameChangedAt = profile?.username_changed_at;
                const isLocked = usernameChangedAt !== null && usernameChangedAt !== undefined;
                let daysRemaining = 0;
                if (isLocked && usernameChangedAt) {
                  const lastChanged = new Date(usernameChangedAt);
                  const now = new Date();
                  const daysSinceChange = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                  daysRemaining = Math.ceil(30 - daysSinceChange);
                }
                const canChange = !isLocked || daysRemaining <= 0;
                
                return (
                  <>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-zinc-400 dark:text-zinc-500 font-medium text-sm">@</span>
                      <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        disabled={!canChange && username === currentUsername}
                        className={`w-full pl-9 pr-10 py-3 bg-zinc-50 dark:bg-dpurple-800 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 ${
                          !canChange && username === currentUsername
                            ? 'opacity-60 cursor-not-allowed'
                            : username !== currentUsername && username.length > 0
                            ? isValid
                              ? 'border-violet-300 focus:ring-violet-200 focus:border-violet-400'
                              : 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30'
                            : 'border-zinc-200 dark:border-dpurple-700 focus:ring-violet-200 dark:focus:ring-violet-800 focus:border-violet-300 dark:focus:border-violet-600'
                        }`}
                        placeholder="username"
                      />
                
                {/* Status Indicator Icon */}
                <div className="absolute right-3 top-3.5">
                  {checkingUsername ? (
                    <LavenderLoader size="sm" />
                  ) : username !== currentUsername && username.length > 0 ? (
                    isValid ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <X className="w-5 h-5 text-red-400" />
                    )
                  ) : null}
                </div>
              </div>
              
              {/* Lock Message */}
              {!canChange && username === currentUsername && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Username can only be changed once every 30 days. You can change it again in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
                  </p>
                </div>
              )}
              
              {/* Validation Message */}
              <div className="h-5 mt-1 ml-1">
                {username !== currentUsername && username.length > 0 && (
                  <>
                    {checkingUsername && (
                      <span className="text-xs text-zinc-400">Checking availability...</span>
                    )}
                    {!checkingUsername && usernameError && (
                      <span className="text-xs text-red-500 font-medium">{usernameError}</span>
                    )}
                    {!checkingUsername && isValid && (
                      <span className="text-xs text-green-600 font-medium">Username available</span>
                    )}
                  </>
                )}
              </div>
                  </>
                );
              })()}
            </div>

            {/* Bio Input */}
            <div className="mb-6">
              <label htmlFor="bio" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => {
                  if (e.target.value.length <= BIO_MAX_LENGTH) {
                    setBio(e.target.value)
                  }
                }}
                rows={3}
                className="w-full rounded-xl border border-zinc-200 dark:border-dpurple-700 bg-white dark:bg-dpurple-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-sm focus:border-violet-300 dark:focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-800 transition-colors resize-none"
                placeholder="Tell us about yourself..."
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${
                  bio.length >= BIO_MAX_LENGTH 
                    ? 'text-red-500 font-medium' 
                    : 'text-zinc-400'
                }`}>
                  {bio.length}/{BIO_MAX_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              {(() => {
                const isUsernameChanging = username !== currentUsername;
                const usernameChangedAtDate = profile?.username_changed_at;
                let isUsernameLocked = false;
                if (usernameChangedAtDate && isUsernameChanging) {
                  const lastChanged = new Date(usernameChangedAtDate);
                  const now = new Date();
                  const daysSinceChange = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
                  isUsernameLocked = daysSinceChange < 30;
                }
                const isDisabled = saving || (isUsernameChanging && !isValid) || isUsernameLocked;
                
                return (
                  <button
                    type="submit"
                    disabled={isDisabled}
                    className="px-6 py-2.5 bg-violet-500 text-white rounded-full text-sm font-medium hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                );
              })()}
            </div>
          </form>

          {/* Settings Navigation */}
          <div className="mt-8 pt-8 border-t border-zinc-200 dark:border-dpurple-700">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Settings</h3>
            <div className="space-y-1">
              <button
                onClick={() => router.push('/settings')}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-zinc-700 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-dpurple-800 hover:text-violet-700 dark:hover:text-violet-400 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-dpurple-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-950/50 flex items-center justify-center transition-colors">
                  <User size={16} className="text-zinc-500 dark:text-zinc-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">Profile Settings</span>
                  <p className="text-xs text-zinc-400">Name, username, bio, social links</p>
                </div>
                <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 group-hover:text-violet-400 transition-colors" />
              </button>

              <button
                onClick={() => router.push('/settings#content')}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-zinc-700 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-dpurple-800 hover:text-violet-700 dark:hover:text-violet-400 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-dpurple-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-950/50 flex items-center justify-center transition-colors">
                  <Shield size={16} className="text-zinc-500 dark:text-zinc-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">Content & Privacy</span>
                  <p className="text-xs text-zinc-400">Adult content filter, preferences</p>
                </div>
                <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 group-hover:text-violet-400 transition-colors" />
              </button>

              <button
                onClick={() => router.push('/settings#creator')}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-zinc-700 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-dpurple-800 hover:text-violet-700 dark:hover:text-violet-400 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-dpurple-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-950/50 flex items-center justify-center transition-colors">
                  <LinkIcon size={16} className="text-zinc-500 dark:text-zinc-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">Creator & Monetization</span>
                  <p className="text-xs text-zinc-400">Amazon affiliate, social links</p>
                </div>
                <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 group-hover:text-violet-400 transition-colors" />
              </button>

              <button
                onClick={() => router.push('/support')}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-zinc-700 dark:text-zinc-300 hover:bg-violet-50 dark:hover:bg-dpurple-800 hover:text-violet-700 dark:hover:text-violet-400 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-dpurple-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-950/50 flex items-center justify-center transition-colors">
                  <Bell size={16} className="text-zinc-500 dark:text-zinc-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">Help & Support</span>
                  <p className="text-xs text-zinc-400">FAQs, troubleshooting, contact</p>
                </div>
                <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 group-hover:text-violet-400 transition-colors" />
              </button>
            </div>
          </div>

          {/* Back to Dashboard */}
          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-dpurple-700">
            <button 
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-50 dark:bg-dpurple-800 px-4 py-3 text-zinc-600 dark:text-zinc-300 font-semibold hover:bg-zinc-100 dark:hover:bg-dpurple-700 transition-colors"
            >
              <ArrowLeft size={18} /> Back to Dashboard
            </button>
          </div>
        </div>

        {/* Footer Link - Sign Out */}
        <div className="mt-4 p-4 text-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
              router.refresh()
            }}
            className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center justify-center gap-2 mx-auto"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
