export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth'

/**
 * GET /api/admin/audit?action=&from=&to=&limit=50&offset=0
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')?.trim()
  const from = searchParams.get('from')?.trim()
  const to = searchParams.get('to')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

  const supabase = getAdminClient()
  let q = supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) q = q.ilike('action', `%${action}%`)
  if (from) q = q.gte('created_at', new Date(from).toISOString())
  if (to) q = q.lte('created_at', new Date(to).toISOString())

  const { data, error, count } = await q

  if (error) {
    if (error.message?.includes('relation') || error.code === '42P01') {
      return NextResponse.json({
        events: [],
        total: 0,
        hint: 'Run the migration supabase/migrations/20260402120000_admin_audit_settings.sql in Supabase SQL editor.',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: data ?? [], total: count ?? 0 })
}
