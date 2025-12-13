import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useUsername(initialUsername: string = '') {
  const [username, setUsername] = useState(initialUsername)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isValid, setIsValid] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Regex: 3-20 chars, letters, numbers, underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/

  useEffect(() => {
    // 1. Basic client-side validation
    if (!username) {
      setIsValid(false)
      setIsAvailable(true)
      setError(null)
      return
    }

    if (!usernameRegex.test(username)) {
      setIsValid(false)
      setIsAvailable(false)
      setError('3-20 characters, letters/numbers/underscores only')
      return
    }

    // Don't check availability if it's the user's current username
    if (username === initialUsername) {
      setIsValid(true)
      setIsAvailable(true)
      setError(null)
      return
    }

    // 2. Debounced Database Check
    const checkAvailability = setTimeout(async () => {
      setLoading(true)
      setError(null)
      
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single()

      if (dbError && dbError.code === 'PGRST116') {
        // Error code 116 means "No rows found", which means username is FREE!
        setIsAvailable(true)
        setIsValid(true)
        setError(null)
      } else if (data) {
        // If data is returned, username IS TAKEN
        setIsAvailable(false)
        setIsValid(false)
        setError('Username is already taken')
      } else if (dbError) {
        // Some other error
        setIsAvailable(false)
        setIsValid(false)
        setError('Error checking username')
      }
      
      setLoading(false)
    }, 500) // Wait 500ms after typing stops

    return () => clearTimeout(checkAvailability)
  }, [username, initialUsername])

  return { 
    username, 
    setUsername, 
    isAvailable, 
    isValid, 
    loading, 
    error 
  }
}

