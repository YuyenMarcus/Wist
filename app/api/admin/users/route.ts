export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth'
import { logAdminAction, clientIpFromRequest } from '@/lib/admin/audit'

const VALID_TIERS = new Set(['free', 'pro', 'creator', 'enterprise'])

/**
 * GET /api/admin/users?q=&tier=&page=0&limit=20
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const tier = searchParams.get('tier') || ''
  const page = parseInt(searchParams.get('page') || '0', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)
  const offset = page * limit

  const supabase = getAdminClient()

  let dbQuery = supabase
    .from('profiles')
    .select(
      'id, email, full_name, username, avatar_url, subscription_tier, is_admin, is_banned, ban_reason, age, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tier && VALID_TIERS.has(tier)) {
    dbQuery = dbQuery.eq('subscription_tier', tier)
  }

  if (query) {
    const sanitized = query.replace(/[%_(),."'\\]/g, '')
    if (sanitized) {
      dbQuery = dbQuery.or(
        `email.ilike.%${sanitized}%,username.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`
      )
    }
  }

  const { data, error, count } = await dbQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (data || []).map((u) => u.id)
  const itemCounts: Record<string, number> = {}

  if (userIds.length > 0) {
    const { data: items } = await supabase
      .from('items')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'active')

    if (items) {
      for (const item of items) {
        itemCounts[item.user_id] = (itemCounts[item.user_id] || 0) + 1
      }
    }
  }

  const lastSignIn: Record<string, string | null> = {}
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const { data: udata, error: uerr } = await supabase.auth.admin.getUserById(uid)
        if (!uerr && udata?.user) lastSignIn[uid] = udata.user.last_sign_in_at ?? null
        else lastSignIn[uid] = null
      } catch {
        lastSignIn[uid] = null
      }
    })
  )

  const users = (data || []).map((u) => ({
    ...u,
    item_count: itemCounts[u.id] || 0,
    last_sign_in_at: lastSignIn[u.id] ?? null,
  }))

  return NextResponse.json({ users, total: count || 0 })
}

/**
 * PATCH /api/admin/users
 */
export async function PATCH(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { user_id, subscription_tier, is_banned, ban_reason, is_admin } = body

  if (!user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const ip = clientIpFromRequest(request)

  const { data: before } = await supabase
    .from('profiles')
    .select('subscription_tier, is_banned, ban_reason, is_admin, email')
    .eq('id', user_id)
    .maybeSingle()

  const updateData: Record<string, unknown> = {}

  if (subscription_tier !== undefined) updateData.subscription_tier = subscription_tier
  if (is_banned !== undefined) updateData.is_banned = is_banned
  if (ban_reason !== undefined) updateData.ban_reason = ban_reason
  if (is_admin !== undefined) updateData.is_admin = is_admin

  if (is_banned === true) {
    const email = before?.email
    if (email) {
      await supabase.from('banned_emails').upsert(
        { email, reason: ban_reason || 'Banned by admin', banned_by: adminId },
        { onConflict: 'email' }
      )
    }
  }

  if (is_banned === false) {
    const email = before?.email
    if (email) {
      await supabase.from('banned_emails').delete().eq('email', email)
    }
  }

  const { data, error } = await supabase.from('profiles').update(updateData).eq('id', user_id).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const diff: Record<string, { from: unknown; to: unknown }> = {}
  if (subscription_tier !== undefined && before?.subscription_tier !== data?.subscription_tier) {
    diff.subscription_tier = { from: before?.subscription_tier, to: data?.subscription_tier }
  }
  if (is_banned !== undefined && before?.is_banned !== data?.is_banned) {
    diff.is_banned = { from: before?.is_banned, to: data?.is_banned }
  }
  if (is_admin !== undefined && before?.is_admin !== data?.is_admin) {
    diff.is_admin = { from: before?.is_admin, to: data?.is_admin }
  }
  if (ban_reason !== undefined && before?.ban_reason !== data?.ban_reason) {
    diff.ban_reason = { from: before?.ban_reason, to: data?.ban_reason }
  }

  await logAdminAction({
    actorId: adminId,
    action: 'user.profile_update',
    entityType: 'profile',
    entityId: user_id,
    metadata: { diff, target_email: data?.email ?? before?.email },
    ipAddress: ip,
  })

  return NextResponse.json({ success: true, user: data })
}
