'use client'

import { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { translate } from './index'
export type { Locale } from './index'
import type { Locale } from './index'

interface I18nContextValue {
  locale: Locale
  t: (key: string) => string
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  t: (key: string) => key,
  setLocale: () => {},
})

export function I18nProvider({ children, initialLocale = 'en' }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    const saved = document.cookie
      .split('; ')
      .find(c => c.startsWith('locale='))
      ?.split('=')[1] as Locale | undefined
    if (saved && (saved === 'en' || saved === 'es')) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
  }, [])

  const t = useCallback((key: string) => translate(key, locale), [locale])

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
