import { cookies } from 'next/headers'
import { translate, type Locale } from './index'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value as Locale | undefined
  return locale === 'es' ? 'es' : 'en'
}

export async function getServerTranslation() {
  const locale = await getLocale()
  return {
    locale,
    t: (key: string, vars?: Record<string, string>) => translate(key, locale, vars),
  }
}
