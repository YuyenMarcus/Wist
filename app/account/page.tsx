'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, X, LogOut, ArrowLeft } from 'lucide-react'
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
        // Check for unique constraint violation
        if (updateError.code === '23505' || updateError.message.includes('unique')) {
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <LavenderLoader size="lg" />
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <a href="/login" className="mt-4 text-violet-600 hover:underline">
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-semibold text-zinc-900 mb-12 text-center"
        >
          Account Settings
        </motion.h1>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-lg bg-green-50 p-4 border border-green-200"
            >
              <p className="text-sm font-medium text-green-800">
                Profile updated successfully!
              </p>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200"
            >
              <p className="text-sm font-medium text-red-800">{error}</p>
            </motion.div>
          )}

          {/* Avatar Upload Section */}
          <div className="mb-8">
            <label className="block text-xs font-medium text-zinc-500 mb-4 text-center">
              Profile Picture
            </label>
            <div className="flex justify-center">
              <div className="relative group">
                <div className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-100 border-4 border-white shadow-lg">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-16 h-16 text-zinc-400"
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
            <p className="text-sm text-zinc-500 mb-1">
              <span className="font-medium">Email:</span> {profile?.email || user?.email || 'N/A'}
            </p>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSave}>
            <div className="mb-6">
              <label htmlFor="full_name" className="block text-xs font-medium text-zinc-500 mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200 transition-colors"
                placeholder="Enter your full name"
              />
            </div>

            {/* Username Input */}
            <div className="mb-6">
              <label htmlFor="username" className="block text-xs font-medium text-zinc-500 mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-zinc-400 font-medium text-sm">@</span>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className={`w-full pl-9 pr-10 py-3 bg-zinc-50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm text-zinc-900 placeholder-zinc-400 ${
                    username !== currentUsername && username.length > 0
                      ? isValid
                        ? 'border-violet-300 focus:ring-violet-200 focus:border-violet-400'
                        : 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30'
                      : 'border-zinc-200 focus:ring-violet-200 focus:border-violet-300'
                  }`}
                  placeholder="marcus"
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
            </div>

            {/* Bio Input */}
            <div className="mb-6">
              <label htmlFor="bio" className="block text-xs font-medium text-zinc-500 mb-2">
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
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200 transition-colors resize-none"
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
                className="px-6 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (username !== currentUsername && !isValid)}
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
            </div>
          </form>

          {/* Sign Out Section */}
          <div className="mt-8 pt-8 border-t border-zinc-200">
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
                router.refresh()
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-red-600 font-semibold hover:bg-red-100 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Footer Link */}
        <div className="bg-zinc-50 p-4 text-center border-t border-zinc-200">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-sm text-zinc-600 hover:text-violet-600 font-medium flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
