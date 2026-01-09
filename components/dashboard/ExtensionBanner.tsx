'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Chrome } from 'lucide-react'

export default function ExtensionBanner() {
  const [isVisible, setIsVisible] = useState(false) // Default to false to prevent flicker

  useEffect(() => {
    // 1. Check if user permanently dismissed it
    const isDismissed = localStorage.getItem('wist_extension_dismissed')
    if (isDismissed) return

    // 2. Check if extension is installed
    // We poll for a few seconds because extensions load asynchronously
    const checkExtension = () => {
      const isInstalled = document.documentElement.getAttribute('data-wist-installed') === 'true'
      if (isInstalled) {
        setIsVisible(false)
        return true // Found it
      }
      return false // Not found yet
    }

    // Run immediate check
    if (checkExtension()) return

    // If not found immediately, show banner, but keep checking briefly
    setIsVisible(true)

    const intervalId = setInterval(() => {
      if (checkExtension()) {
        setIsVisible(false) // Hide immediately if detected later
        clearInterval(intervalId)
      }
    }, 500)

    // Stop checking after 3 seconds to save performance
    setTimeout(() => clearInterval(intervalId), 3000)

    // Cleanup
    return () => clearInterval(intervalId)
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('wist_extension_dismissed', 'true')
  }

  if (!isVisible) return null

  return (
    <div className="relative bg-gradient-to-r from-violet-50 to-pink-50 border-b border-violet-100 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex p-2 bg-violet-600 rounded-lg">
          <Chrome className="h-5 w-5 text-white" />
        </div>
        <p className="font-medium text-sm sm:text-base text-zinc-900">
          <span className="md:hidden">Save items in 1 click. </span>
          <span className="hidden md:inline">Stop copying and pasting links. Save items from Amazon & Target instantly.</span>
        </p>
      </div>
      
      <div className="mt-4 sm:mt-0 sm:ml-6 flex items-center gap-4">
        <Link 
          href="/extension" 
          className="whitespace-nowrap rounded-md bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 transition-colors"
        >
          Get the Button
        </Link>
        <button 
          onClick={handleDismiss} 
          className="-mr-1 flex p-2 rounded-md hover:bg-white/50 focus:outline-none sm:-mr-2 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-5 w-5 text-zinc-500 hover:text-zinc-700" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
