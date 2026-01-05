'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { getProfile, updateProfile } from '@/lib/supabase/profile'
import { motion, AnimatePresence } from 'framer-motion'

export default function ShareButton() {
  const [showModal, setShowModal] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Load user profile
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const { data: profile } = await getProfile(user.id)
      if (profile) {
        setUsername(profile.username)
      }
    }

    loadProfile()
  }, [])

  // Check username availability
  const checkUsername = async (value: string): Promise<boolean> => {
    if (!value.trim()) return false

    // Basic validation
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens')
      return false
    }

    if (value.length < 3 || value.length > 30) {
      setError('Username must be between 3 and 30 characters')
      return false
    }

    // Check availability
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', value.toLowerCase())
      .single()

    if (data && data.username !== username) {
      setError('Username is already taken')
      return false
    }

    setError(null)
    return true
  }

  // Handle share
  const handleShare = async () => {
    if (!userId) {
      alert('Please log in to share your wishlist')
      return
    }

    // If user has username, copy link
    if (username) {
      const shareUrl = `https://wishlist.nuvio.cloud/u/${username}`
      await navigator.clipboard.writeText(shareUrl)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      return
    }

    // Otherwise, show modal to set username
    setShowModal(true)
  }

  // Save username
  const handleSaveUsername = async () => {
    if (!newUsername.trim()) {
      setError('Please enter a username')
      return
    }

    const isValid = await checkUsername(newUsername.trim())
    if (!isValid) return

    setSaving(true)
    setError(null)

    try {
      const { data, error: updateError } = await updateProfile(userId!, {
        username: newUsername.trim().toLowerCase(),
      })

      if (updateError) throw updateError

      setUsername(data?.username || null)
      setShowModal(false)
      setNewUsername('')

      // Copy link after saving
      const shareUrl = `https://wishlist.nuvio.cloud/u/${data?.username}`
      await navigator.clipboard.writeText(shareUrl)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save username')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-600 rounded-full text-sm font-medium border border-zinc-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-300 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        Share List
      </button>

      {/* Success Toast */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium shadow-lg z-50"
          >
            Link copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Username Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-semibold text-zinc-900 mb-2">
                  Claim a Username
                </h2>
                <p className="text-sm text-zinc-500 mb-6">
                  Choose a unique username to share your wishlist with friends.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => {
                        setNewUsername(e.target.value)
                        setError(null)
                      }}
                      placeholder="your-username"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <p className="mt-1 text-xs text-zinc-400">
                      Only letters, numbers, underscores, and hyphens. 3-30 characters.
                    </p>
                  </div>

                  {error && (
                    <div className="text-sm text-red-600">{error}</div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowModal(false)
                        setNewUsername('')
                        setError(null)
                      }}
                      className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveUsername}
                      disabled={saving || !newUsername.trim()}
                      className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save & Share'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}






