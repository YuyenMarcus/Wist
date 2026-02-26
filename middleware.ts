import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SPANISH_COUNTRIES = new Set([
  'MX', 'GT', 'SV', 'HN', 'NI', 'CR', 'PA',
  'CO', 'VE', 'EC', 'PE', 'BO', 'PY', 'UY',
  'AR', 'CL', 'CU', 'DO', 'PR', 'ES', 'GQ',
])

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // --- Locale detection ---
  // Determine locale: check existing cookie first, then detect
  let detectedLocale: 'en' | 'es' = 'en'
  const existingLocale = request.cookies.get('locale')?.value

  if (existingLocale === 'en' || existingLocale === 'es') {
    detectedLocale = existingLocale
  } else {
    // No cookie yet — detect from headers
    const country = request.headers.get('x-vercel-ip-country') || ''
    const acceptLang = request.headers.get('accept-language') || ''

    if (country && SPANISH_COUNTRIES.has(country.toUpperCase())) {
      detectedLocale = 'es'
    } else if (acceptLang) {
      const primary = acceptLang.split(',')[0]?.trim().toLowerCase() || ''
      if (primary.startsWith('es')) {
        detectedLocale = 'es'
      }
    }
    // Default stays 'en' if nothing matched
  }

  // --- Supabase auth ---
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
          // Re-apply locale cookie after response recreation
          response.cookies.set('locale', detectedLocale, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
          // Re-apply locale cookie after response recreation
          response.cookies.set('locale', detectedLocale, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  // Always set locale cookie on the final response
  if (!existingLocale || existingLocale !== detectedLocale) {
    response.cookies.set('locale', detectedLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
