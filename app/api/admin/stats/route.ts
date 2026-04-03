export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/**
 * GET /api/admin/stats — aggregate counts for admin dashboard (admin-only).
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const now = new Date()

  const day30 = addDays(now, -30)
  const day60 = addDays(now, -60)
  const week8 = addDays(now, -56)

  const tierIds = ['free', 'pro', 'creator', 'enterprise'] as const

  const [
    totalUsersRes,
    usersLast30Res,
    usersPrev30Res,
    activeItemsRes,
    bannedRes,
    profilesRecentRes,
    itemsNew30Res,
    itemsNewPrev30Res,
    bannedNew30Res,
    bannedNewPrev30Res,
    ...tierCountRes
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', day30.toISOString()),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', day60.toISOString())
      .lt('created_at', day30.toISOString()),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('banned_emails').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('created_at').gte('created_at', week8.toISOString()),
    supabase.from('items').select('*', { count: 'exact', head: true }).gte('created_at', day30.toISOString()),
    supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', day60.toISOString())
      .lt('created_at', day30.toISOString()),
    supabase.from('banned_emails').select('*', { count: 'exact', head: true }).gte('created_at', day30.toISOString()),
    supabase
      .from('banned_emails')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', day60.toISOString())
      .lt('created_at', day30.toISOString()),
    ...tierIds.map((t) =>
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', t)
    ),
  ])

  const totalUsers = totalUsersRes.count ?? 0
  const newUsers30 = usersLast30Res.count ?? 0
  const newUsersPrev30 = usersPrev30Res.count ?? 0
  const activeItems = activeItemsRes.count ?? 0
  const bannedCount = bannedRes.count ?? 0

  const signupDeltaPct =
    newUsersPrev30 > 0
      ? Math.round(((newUsers30 - newUsersPrev30) / newUsersPrev30) * 1000) / 10
      : newUsers30 > 0
        ? 100
        : 0

  const tierCounts: Record<string, number> = {}
  tierIds.forEach((t, i) => {
    tierCounts[t] = tierCountRes[i]?.count ?? 0
  })
  const otherTiers = (totalUsersRes.count ?? 0) - tierIds.reduce((s, t) => s + (tierCounts[t] || 0), 0)
  if (otherTiers > 0) tierCounts.other = otherTiers
  const paidMembers =
    (tierCounts.pro || 0) + (tierCounts.creator || 0) + (tierCounts.enterprise || 0)

  const itemsNew30 = itemsNew30Res.count ?? 0
  const itemsNewPrev30 = itemsNewPrev30Res.count ?? 0
  const itemsDeltaPct =
    itemsNewPrev30 > 0
      ? Math.round(((itemsNew30 - itemsNewPrev30) / itemsNewPrev30) * 1000) / 10
      : itemsNew30 > 0
        ? 100
        : 0

  const bannedNew30 = bannedNew30Res.count ?? 0
  const bannedNewPrev30 = bannedNewPrev30Res.count ?? 0
  const bannedDeltaPct =
    bannedNewPrev30 > 0
      ? Math.round(((bannedNew30 - bannedNewPrev30) / bannedNewPrev30) * 1000) / 10
      : bannedNew30 > 0
        ? 100
        : 0

  const paidSharePct =
    totalUsers > 0 ? Math.round((paidMembers / totalUsers) * 1000) / 10 : 0

  const oldestWeekStart = startOfDay(addDays(now, -56))
  const weeklySignups = Array.from({ length: 8 }, (_, k) => {
    const start = addDays(oldestWeekStart, k * 7)
    const end = addDays(start, 7)
    const label = `${start.getMonth() + 1}/${start.getDate()}`
    let c = 0
    for (const row of profilesRecentRes.data || []) {
      const created = row.created_at ? new Date(row.created_at) : null
      if (created && created >= start && created < end) c++
    }
    return { week: label, signups: c }
  })

  const tierBreakdown = Object.entries(tierCounts).map(([name, value]) => ({
    name,
    value,
  }))

  return NextResponse.json({
    kpis: {
      totalUsers,
      newUsers30,
      signupDeltaPct,
      activeItems,
      bannedCount,
      paidMembers,
      itemsDeltaPct,
      itemsNew30,
      bannedDeltaPct,
      paidSharePct,
    },
    weeklySignups,
    tierBreakdown,
  })
}
