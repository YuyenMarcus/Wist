'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Chrome } from 'lucide-react'

export default function ExtensionBanner() {
  const [isVisible, setIsVisible] = useState(false) // Default to false to prevent flicker

  useEffect(() => {
    // Check if extension is installed
    // We poll for a few seconds because extensions load asynchronously
    const checkExtension = () => {
      const isInstalled = document.documentElement.getAttribute('data-wist-installed') === 'true'
      return isInstalled
    }

    // Check if banner was dismissed in this session (temporary dismissal)
    const isDismissedThisSession = sessionStorage.getItem('wist_extension_dismissed_session') === 'true'

    // Run immediate check
    const isInstalled = checkExtension()
    
    // If extension is installed, always hide the banner
    if (isInstalled) {
      setIsVisible(false)
      return
    }

    // If extension is NOT installed, show banner unless dismissed this session
    // This allows the banner to reappear on next page load if extension is still not installed
    if (!isDismissedThisSession) {
      setIsVisible(true)
    }

    // Keep checking for extension installation for a few seconds
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
    // Store dismissal in sessionStorage (not localStorage) so it only persists for this session
    // This allows the banner to reappear on next page load if extension is still not installed
    sessionStorage.setItem('wist_extension_dismissed_session', 'true')
  }

  if (!isVisible) return null

  return (
    <div className="ExtensionBanner relative bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/40 dark:to-pink-950/40 border-b border-violet-100 dark:border-violet-900 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex p-2 bg-violet-600 rounded-lg">
          <Chrome className="h-5 w-5 text-white" />
        </div>
        <p className="font-medium text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
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
