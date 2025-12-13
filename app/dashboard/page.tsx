'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import AddItemForm from '@/components/dashboard/AddItemForm'
import WishlistGrid from '@/components/dashboard/WishlistGrid'

export default function DashboardPage() {
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        setUser({ id: currentUser.id })
      }
      setLoading(false)
    }

    loadUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[var(--color-brand-blue)] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 dark:text-gray-100 mb-4">Please log in to view your dashboard</p>
          <a
            href="/login"
            className="px-4 py-2 text-white rounded-md transition-colors text-sm font-medium inline-block"
            style={{
              backgroundColor: 'var(--color-brand-blue)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#a78bfa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-brand-blue)';
            }}
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            My Wishlist
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add items to your wishlist and share with friends
          </p>
        </div>

        {/* Add Item Form */}
        <div className="mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Add New Item
            </h2>
            <AddItemForm />
          </div>
        </div>

        {/* Wishlist Grid */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Your Items
          </h2>
          <WishlistGrid userId={user.id} isOwner={true} />
        </div>
      </div>
    </div>
  )
}

