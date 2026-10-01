import client from './client'
import type {
  ExtraLessonAbsence,
  ExtraLessonAbsenceReason,
  ExtraLessonEntry,
  ExtraLessonMonthlySummaryRow,
  ExtraLessonPayload,
} from '../types/extraLesson'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function listExtraLessons(params?: { teacher_id?: number; year?: number; month?: number }): Promise<ExtraLessonEntry[]> {
  const { data } = await client.get<Envelope<ExtraLessonEntry[]>>('/api/extra-lessons', { params })
  return data.data
}

export async function createExtraLesson(tenantId: number, payload: ExtraLessonPayload): Promise<ExtraLessonEntry> {
  const { data } = await client.post<Envelope<ExtraLessonEntry>>('/api/extra-lessons', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateExtraLesson(id: number, payload: Partial<ExtraLessonPayload>): Promise<ExtraLessonEntry> {
  const { data } = await client.put<Envelope<ExtraLessonEntry>>(`/api/extra-lessons/${id}`, payload)
  return data.data
}

export async function deleteExtraLesson(id: number): Promise<void> {
  await client.delete(`/api/extra-lessons/${id}`)
}

export async function suggestLessonLoad(
  teacherId: number,
  year: number,
  month: number,
): Promise<{ suggested_hours: number; leave_days_in_period: number; note: string }> {
  const { data } = await client.get<Envelope<{ suggested_hours: number; leave_days_in_period: number; note: string }>>(
    '/api/extra-lessons/suggest-lesson-load',
    { params: { teacher_id: teacherId, year, month } },
  )
  return data.data
}

export async function fetchExtraLessonMonthlySummary(year: number, month: number): Promise<ExtraLessonMonthlySummaryRow[]> {
  const { data } = await client.get<Envelope<ExtraLessonMonthlySummaryRow[]>>('/api/extra-lessons/monthly-summary', {
    params: { year, month },
  })
  return data.data
}

export async function listExtraLessonAbsences(year: number, month: number, teacherId?: number): Promise<ExtraLessonAbsence[]> {
  const { data } = await client.get<Envelope<ExtraLessonAbsence[]>>('/api/extra-lessons/absences', {
    params: { year, month, teacher_id: teacherId },
  })
  return data.data
}

export async function saveExtraLessonAbsence(payload: {
  teacher_id: number
  absence_date: string
  reason: ExtraLessonAbsenceReason
  note?: string | null
}): Promise<ExtraLessonAbsence> {
  const { data } = await client.put<Envelope<ExtraLessonAbsence>>('/api/extra-lessons/absences', payload)
  return data.data
}

export async function deleteExtraLessonAbsence(id: number): Promise<void> {
  await client.delete(`/api/extra-lessons/absences/${id}`)
}

export async function exportExtraLessons(payload: { format: ExportFormat; year?: number; month?: number }): Promise<Blob> {
  const { data } = await client.post('/api/extra-lessons/export', payload, { responseType: 'blob', timeout: 60000 })
  return data as Blob
}
