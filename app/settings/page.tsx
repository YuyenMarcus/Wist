'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Loader2, AlertCircle, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { getProfile, updateProfile } from '@/lib/supabase/profile'
import LavenderLoader from '@/components/ui/LavenderLoader'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  
  // Form State
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    fullName: ''
  })

  // 1. Load User Data on Mount
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
          setFormData({
            username: data.username || '',
            bio: data.bio || '',
            fullName: data.full_name || ''
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
      const { data, error } = await updateProfile(user.id, {
        username: formData.username.trim() || null,
        bio: formData.bio.trim() || null,
        full_name: formData.fullName.trim() || null,
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      
    } catch (error: any) {
      // 3. Catch Duplicate Username Error specifically
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
      <div className="flex justify-center items-center min-h-screen bg-zinc-50">
        <LavenderLoader size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-900 mb-8">Profile Settings</h1>

        <form onSubmit={handleUpdate} className="space-y-6 bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
          
          {/* Username Field */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-zinc-400">@</span>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '').replace(/[^a-zA-Z0-9_]/g, '') })}
                className="w-full pl-8 pr-4 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900"
                placeholder="username"
                required
                minLength={3}
                pattern="^[a-zA-Z0-9_]+$"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              This will be your URL: wist.app/{formData.username || 'username'}
            </p>
          </div>

          {/* Full Name Field */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition text-zinc-900"
              placeholder="Enter your full name"
            />
          </div>

          {/* Bio Field */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Bio</label>
            <textarea
              value={formData.bio}
              onChange={(e) => {
                if (e.target.value.length <= 160) {
                  setFormData({ ...formData, bio: e.target.value })
                }
              }}
              rows={4}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition resize-none text-zinc-900"
              placeholder="Tell us a bit about yourself..."
              maxLength={160}
            />
            <div className="text-right text-xs text-zinc-400 mt-1">
              {formData.bio.length}/160
            </div>
          </div>

          {/* Feedback Message */}
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

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-violet-600 text-white font-semibold py-3 rounded-xl hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 focus:outline-none focus:ring-2 focus:ring-violet-200"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.back()}
            className="text-sm text-zinc-600 hover:text-violet-600 font-medium transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
