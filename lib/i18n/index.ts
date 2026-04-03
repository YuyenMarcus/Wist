import en from './translations/en'
import es from './translations/es'

export type Locale = 'en' | 'es'

const translations: Record<Locale, Record<string, string>> = { en, es }

export function translate(key: string, locale: Locale, vars?: Record<string, string>): string {
  let s = locale === 'en' ? key : translations[locale]?.[key] || key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(v)
    }
  }
  return s
}

export const SPANISH_COUNTRIES = new Set([
  'MX', 'GT', 'SV', 'HN', 'NI', 'CR', 'PA',
  'CO', 'VE', 'EC', 'PE', 'BO', 'PY', 'UY',
  'AR', 'CL', 'CU', 'DO', 'PR', 'ES', 'GQ',
])

export function detectLocaleFromHeaders(
  country?: string | null,
  acceptLanguage?: string | null
): Locale {
  if (country && SPANISH_COUNTRIES.has(country.toUpperCase())) {
    return 'es'
  }

  if (acceptLanguage) {
    const langs = acceptLanguage.toLowerCase()
    if (langs.startsWith('es') || langs.includes(',es') || langs.includes(', es')) {
      return 'es'
    }
  }

  return 'en'
}
