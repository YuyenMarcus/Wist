export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const [itemsRes, productsRes] = await Promise.all([
      supabase.from('items').select('id, title, status, user_id, created_at').eq('user_id', user.id),
      supabase.from('products').select('id, title, user_id, created_at').eq('user_id', user.id),
    ])

    const items = itemsRes.data || []
    const products = productsRes.data || []
    const statusCounts = items.reduce((acc: Record<string, number>, item) => {
      const s = item.status ?? '(null)'
      acc[s] = (acc[s] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      userId: user.id,
      itemsCount: items.length,
      productsCount: products.length,
      statusCounts,
      itemsError: itemsRes.error?.message ?? null,
      productsError: productsRes.error?.message ?? null,
      sampleItems: items.slice(0, 5),
      sampleProducts: products.slice(0, 5),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
