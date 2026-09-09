export interface AuditLog {
  id: number
  tenant_id: number
  user_id: number | null
  user_email: string | null
  user_name: string | null
  action: string
  entity_type: string
  entity_id: number | null
  summary: string
  meta: Record<string, unknown> | null
  ip: string | null
  created_at: string
}

export interface AuditLogListResult {
  data: AuditLog[]
  total: number
}
