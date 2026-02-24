import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const type = requestUrl.searchParams.get('type')

  const redirectUrl = new URL(next, 'https://wishlist.nuvio.cloud')
  if (type === 'signup') {
    redirectUrl.searchParams.set('confirmed', 'true')
  }

  if (code) {
    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth callback error:', error)
      return NextResponse.redirect(`https://wishlist.nuvio.cloud/login?error=${encodeURIComponent(error.message)}`)
    }

    // Ensure a profile row exists (handles deleted profiles or first-time OAuth)
    if (sessionData?.user) {
      const user = sessionData.user
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existing) {
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          username: (user.email?.split('@')[0] || '').replace(/[^a-zA-Z0-9_-]/g, '') || null,
        })
      }
    }

    return response
  }

  return NextResponse.redirect(redirectUrl)
}

