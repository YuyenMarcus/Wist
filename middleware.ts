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

  // Locale detection: skip if user already has a locale cookie
  if (!request.cookies.get('locale')?.value) {
    const country = request.headers.get('x-vercel-ip-country') || request.geo?.country || ''
    const acceptLang = request.headers.get('accept-language') || ''

    let locale: 'en' | 'es' = 'en'
    if (country && SPANISH_COUNTRIES.has(country.toUpperCase())) {
      locale = 'es'
    } else if (acceptLang.toLowerCase().startsWith('es') || acceptLang.toLowerCase().includes(',es')) {
      locale = 'es'
    }

    response.cookies.set('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

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
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
