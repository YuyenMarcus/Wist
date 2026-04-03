export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth'

/**
 * GET /api/admin/sidebar-counts — badges for nav (admin only).
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const day1 = new Date()
  day1.setDate(day1.getDate() - 1)

  const [bannedRes, signupsRes, auditRes] = await Promise.all([
    supabase.from('banned_emails').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', day1.toISOString()),
    supabase.from('admin_audit_log').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json({
    banned: bannedRes.count ?? 0,
    signups24h: signupsRes.count ?? 0,
    auditEvents: auditRes.error && auditRes.error.code !== '42P01' ? 0 : auditRes.count ?? 0,
  })
}
