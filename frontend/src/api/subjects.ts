import client from './client'
import type { Subject, SubjectPayload } from '../types/subject'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function listSubjects(params?: { is_active?: boolean }): Promise<Subject[]> {
  const query: Record<string, string | boolean> = {}
  if (params?.is_active != null) query.is_active = params.is_active
  const { data } = await client.get<Envelope<Subject[]>>('/api/subjects', { params: query })
  return data.data
}

export async function createSubject(tenantId: number, payload: SubjectPayload): Promise<Subject> {
  const { data } = await client.post<Envelope<Subject>>('/api/subjects', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateSubject(id: number, payload: Partial<SubjectPayload>): Promise<Subject> {
  const { data } = await client.put<Envelope<Subject>>(`/api/subjects/${id}`, payload)
  return data.data
}

export async function deleteSubject(id: number): Promise<void> {
  await client.delete(`/api/subjects/${id}`)
}

export async function exportSubjects(payload: {
  format: ExportFormat
  columns?: string[]
  filters?: { q?: string; is_active?: boolean }
}): Promise<Blob> {
  const { data } = await client.post('/api/subjects/export', payload, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}
