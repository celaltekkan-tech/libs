import client from './client'
import type { Teacher, TeacherPayload } from '../types/teacher'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export interface TeacherFilters {
  q?: string
  school_id?: number
}

export async function listTeachers(): Promise<Teacher[]> {
  const { data } = await client.get<Envelope<Teacher[]>>('/api/teachers')
  return data.data
}

export async function createTeacher(tenantId: number, payload: TeacherPayload): Promise<Teacher> {
  const { data } = await client.post<Envelope<Teacher>>('/api/teachers', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateTeacher(id: number, payload: Partial<TeacherPayload>): Promise<Teacher> {
  const { data } = await client.put<Envelope<Teacher>>(`/api/teachers/${id}`, payload)
  return data.data
}

export async function deleteTeacher(id: number): Promise<void> {
  await client.delete(`/api/teachers/${id}`)
}

export async function exportTeachers(payload: {
  format: ExportFormat
  columns?: string[]
  filters?: TeacherFilters
}): Promise<Blob> {
  const { data } = await client.post('/api/teachers/export', payload, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}

export interface UpcomingPromotion {
  teacher_id: number
  teacher_name: string
  personnel_no: string | null
  degree: string | null
  rank: string | null
  degree_rank_date: string
  next_promotion_date: string
  days_remaining: number
}

export async function fetchUpcomingPromotions(days = 90): Promise<UpcomingPromotion[]> {
  const { data } = await client.get<Envelope<UpcomingPromotion[]>>('/api/teachers/promotions/upcoming', {
    params: { days },
  })
  return data.data
}

export type TeacherDocumentType = 'gorevlendirme' | 'baslama' | 'ayrilis'

export async function downloadTeacherDocument(id: number, type: TeacherDocumentType): Promise<Blob> {
  const { data } = await client.get(`/api/teachers/${id}/document`, {
    params: { type },
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
}
