import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const type = requestUrl.searchParams.get('type') // 'signup' or 'recovery'

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Auth callback error:', error)
      // Redirect to login with error
      return NextResponse.redirect(`https://wishlist.nuvio.cloud/login?error=${encodeURIComponent(error.message)}`)
    }
  }

  // Redirect to the correct domain with confirmation status
  const redirectUrl = new URL(next, 'https://wishlist.nuvio.cloud')
  if (type === 'signup') {
    redirectUrl.searchParams.set('confirmed', 'true')
  }
  return NextResponse.redirect(redirectUrl)
}

