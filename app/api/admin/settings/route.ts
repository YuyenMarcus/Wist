export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { verifyAdmin, getAdminClient } from '@/lib/admin/auth'
import { logAdminAction, clientIpFromRequest } from '@/lib/admin/audit'

const KEYS = ['site_prefs', 'role_matrix'] as const

/**
 * GET /api/admin/settings — merged console settings (admin only).
 */
export async function GET(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase.from('admin_settings').select('key, value').in('key', [...KEYS])

  if (error) {
    if (error.message?.includes('relation') || error.code === '42P01') {
      return NextResponse.json({
        site_prefs: {},
        role_matrix: {},
        hint: 'Run admin_audit_settings migration in Supabase.',
      })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const out: Record<string, unknown> = {}
  for (const row of data || []) {
    out[row.key] = row.value
  }
  return NextResponse.json(out)
}

/**
 * PATCH /api/admin/settings
 * Body: { site_prefs?: object, role_matrix?: object }
 */
export async function PATCH(request: Request) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const supabase = getAdminClient()
  const ip = clientIpFromRequest(request)

  for (const key of KEYS) {
    if (body[key] !== undefined && typeof body[key] === 'object' && body[key] !== null) {
      const { error } = await supabase.from('admin_settings').upsert(
        { key, value: body[key], updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (error) {
        if (error.message?.includes('relation') || error.code === '42P01') {
          return NextResponse.json(
            { error: 'admin_settings table missing. Run the admin migration in Supabase.' },
            { status: 503 }
          )
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await logAdminAction({
        actorId: adminId,
        action: 'settings.update',
        entityType: 'admin_settings',
        metadata: { key },
        ipAddress: ip,
      })
    }
  }

  return NextResponse.json({ success: true })
}
