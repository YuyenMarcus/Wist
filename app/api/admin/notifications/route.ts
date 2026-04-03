export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth'

type Notif = {
  id: string
  title: string
  description: string
  time: string
  href?: string
  icon: 'user' | 'payment' | 'flag' | 'order'
}

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/**
 * GET /api/admin/notifications — derived system events (admin only).
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const now = new Date()
  const day30 = new Date(now)
  day30.setDate(day30.getDate() - 30)
  const day60 = new Date(now)
  day60.setDate(day60.getDate() - 60)
  const day1 = new Date(now)
  day1.setDate(day1.getDate() - 1)

  const [u30, uPrev, banned, signups24, auditRows] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', day30.toISOString()),
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', day60.toISOString())
      .lt('created_at', day30.toISOString()),
    supabase.from('banned_emails').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', day1.toISOString()),
    supabase.from('admin_audit_log').select('id, created_at, action, metadata').order('created_at', { ascending: false }).limit(8),
  ])

  const n30 = u30.count ?? 0
  const nPrev = uPrev.count ?? 0
  const delta =
    nPrev > 0 ? Math.round(((n30 - nPrev) / nPrev) * 1000) / 10 : n30 > 0 ? 100 : 0

  const list: Notif[] = []

  list.push({
    id: 'kpi-signups',
    title: 'Signups (30 days)',
    description: `${n30.toLocaleString()} new users · ${delta >= 0 ? '+' : ''}${delta}% vs prior 30 days`,
    time: relTime(now),
    href: '/admin',
    icon: 'user',
  })

  if ((signups24.count ?? 0) > 0) {
    list.push({
      id: 'signups-24h',
      title: 'New users (24h)',
      description: `${(signups24.count ?? 0).toLocaleString()} registered in the last 24 hours.`,
      time: relTime(day1),
      href: '/admin/users',
      icon: 'user',
    })
  }

  if ((banned.count ?? 0) > 0) {
    list.push({
      id: 'banned-total',
      title: 'Banned emails',
      description: `${(banned.count ?? 0).toLocaleString()} addresses on the blocklist. Review in Banned emails.`,
      time: relTime(now),
      href: '/admin/banned',
      icon: 'flag',
    })
  }

  if (!auditRows.error && auditRows.data?.length) {
    for (const row of auditRows.data) {
      const created = row.created_at ? new Date(row.created_at) : now
      list.push({
        id: `audit-${row.id}`,
        title: row.action.replace(/\./g, ' '),
        description: typeof row.metadata === 'object' && row.metadata
          ? JSON.stringify(row.metadata).slice(0, 120) + (JSON.stringify(row.metadata).length > 120 ? '…' : '')
          : 'Admin action recorded',
        time: relTime(created),
        href: '/admin/audit',
        icon: 'order',
      })
    }
  }

  list.push({
    id: 'tier-chart',
    title: 'Plan mix',
    description: 'Open Overview for signups chart and users-by-plan breakdown.',
    time: 'This week',
    href: '/admin',
    icon: 'payment',
  })

  return NextResponse.json({ notifications: list.slice(0, 25) })
}
