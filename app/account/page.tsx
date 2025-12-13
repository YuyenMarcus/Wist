'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { getProfile, updateProfile, Profile } from '@/lib/supabase/profile'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        setAvatarUrl(profileData?.avatar_url || null)
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

      const { data, error: updateError } = await updateProfile(user.id, {
        full_name: fullName.trim() || null,
      })

      if (updateError) throw updateError

      setProfile(data)
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
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-zinc-500">Loading profile...</p>
        </div>
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
                disabled={saving}
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
        </div>
      </div>
    </div>
  )
}
