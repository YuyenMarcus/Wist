import { getAdminClient } from '@/lib/admin/auth'

export type AdminAuditPayload = {
  actorId: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

export async function logAdminAction(payload: AdminAuditPayload): Promise<void> {
  try {
    const supabase = getAdminClient()
    const { error } = await supabase.from('admin_audit_log').insert({
      actor_id: payload.actorId,
      action: payload.action,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
      metadata: payload.metadata ?? {},
      ip_address: payload.ipAddress ?? null,
    })
    if (error) console.warn('[admin audit] insert failed:', error.message)
  } catch (e) {
    console.warn('[admin audit] insert exception:', e)
  }
}

export function clientIpFromRequest(request: Request): string | null {
  const xf = request.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0]?.trim() || null
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}
