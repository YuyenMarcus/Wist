import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Update request cookies
          request.cookies.set({ name, value, ...options })
          // Create new response with updated cookies
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Set cookie on response with proper options
          response.cookies.set({ 
            name, 
            value, 
            ...options,
            // Ensure cookies work on all paths
            path: '/',
            sameSite: 'lax' as const,
            httpOnly: options.httpOnly ?? true,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Update request cookies
          request.cookies.set({ name, value: '', ...options })
          // Create new response
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Remove cookie from response
          response.cookies.set({ 
            name, 
            value: '', 
            ...options,
            path: '/',
            maxAge: 0,
          })
        },
      },
    }
  )

  // Refresh session - this updates cookies if needed
  const { data: { user } } = await supabase.auth.getUser()

  // If user is authenticated and trying to access login, redirect to dashboard
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If user is NOT authenticated and trying to access dashboard, redirect to login
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

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

