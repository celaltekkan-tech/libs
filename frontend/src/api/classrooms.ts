import client from './client'
import type { Classroom, ClassroomPayload } from '../types/classroom'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export interface ClassroomFilters {
  q?: string
  school_id?: number
  is_active?: boolean
}

export async function listClassrooms(params?: {
  school_id?: number
  is_active?: boolean
}): Promise<Classroom[]> {
  const query: Record<string, string | number | boolean> = {}
  if (params?.school_id != null) query.school_id = params.school_id
  if (params?.is_active != null) query.is_active = params.is_active
  const { data } = await client.get<Envelope<Classroom[]>>('/api/classrooms', { params: query })
  return data.data
}

export async function createClassroom(tenantId: number, payload: ClassroomPayload): Promise<Classroom> {
  const { data } = await client.post<Envelope<Classroom>>('/api/classrooms', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateClassroom(id: number, payload: Partial<ClassroomPayload>): Promise<Classroom> {
  const { data } = await client.put<Envelope<Classroom>>(`/api/classrooms/${id}`, payload)
  return data.data
}

export async function deleteClassroom(id: number): Promise<void> {
  await client.delete(`/api/classrooms/${id}`)
}

export async function exportClassrooms(payload: {
  format: ExportFormat
  columns?: string[]
  filters?: ClassroomFilters
}): Promise<Blob> {
  const { data } = await client.post('/api/classrooms/export', payload, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}
