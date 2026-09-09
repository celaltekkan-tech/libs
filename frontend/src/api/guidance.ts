import client from './client'
import type { GuidanceSession, GuidanceSessionPayload, GuidanceStats } from '../types/guidanceSession'

interface Envelope<T> {
  success: true
  data: T
}

export async function listGuidanceSessions(studentId?: number): Promise<GuidanceSession[]> {
  const { data } = await client.get<Envelope<GuidanceSession[]>>('/api/guidance', {
    params: studentId ? { student_id: studentId } : undefined,
  })
  return data.data
}

export async function createGuidanceSession(tenantId: number, payload: GuidanceSessionPayload): Promise<GuidanceSession> {
  const { data } = await client.post<Envelope<GuidanceSession>>('/api/guidance', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function deleteGuidanceSession(id: number): Promise<void> {
  await client.delete(`/api/guidance/${id}`)
}

export async function fetchGuidanceStats(): Promise<GuidanceStats> {
  const { data } = await client.get<Envelope<GuidanceStats>>('/api/guidance/stats')
  return data.data
}
