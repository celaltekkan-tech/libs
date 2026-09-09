import client from './client'
import type { ParentConsent } from '../types/parentConsent'

interface Envelope<T> {
  success: true
  data: T
}

export async function listParentConsents(studentId?: number): Promise<ParentConsent[]> {
  const { data } = await client.get<Envelope<ParentConsent[]>>('/api/parent-consents', {
    params: studentId ? { student_id: studentId } : undefined,
  })
  return data.data
}

export async function upsertParentConsent(
  tenantId: number,
  payload: { student_id: number; consent_type: string; granted: boolean; notes?: string | null },
): Promise<ParentConsent> {
  const { data } = await client.post<Envelope<ParentConsent>>('/api/parent-consents', { tenant_id: tenantId, ...payload })
  return data.data
}
