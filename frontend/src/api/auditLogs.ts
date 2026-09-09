import client from './client'
import type { AuditLog } from '../types/auditLog'

interface Envelope<T> {
  success: true
  data: T
  meta?: { total: number; limit: number; offset: number }
}

export async function listAuditLogs(params?: {
  q?: string
  action?: string
  entity_type?: string
  limit?: number
  offset?: number
}): Promise<{ rows: AuditLog[]; total: number }> {
  const { data } = await client.get<Envelope<AuditLog[]>>('/api/audit-logs', { params })
  return { rows: data.data, total: data.meta?.total ?? data.data.length }
}
