import client from './client'
import type { AbsenceEntry, AbsenceWarningRow, StudentAbsence } from '../types/studentAbsence'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function listAbsences(params?: {
  student_id?: number
  start_date?: string
  end_date?: string
}): Promise<StudentAbsence[]> {
  const { data } = await client.get<Envelope<StudentAbsence[]>>('/api/absences', { params })
  return data.data
}

export async function bulkCreateAbsences(
  tenantId: number,
  payload: { absence_date: string; entries: AbsenceEntry[] },
): Promise<{ processed: number; created: number; updated: number }> {
  const { data } = await client.post<Envelope<{ processed: number; created: number; updated: number }>>(
    '/api/absences/bulk',
    { tenant_id: tenantId, ...payload },
  )
  return data.data
}

export async function deleteAbsence(id: number): Promise<void> {
  await client.delete(`/api/absences/${id}`)
}

export async function fetchAbsenceWarnings(params?: { start_date?: string; end_date?: string }): Promise<{
  data: AbsenceWarningRow[]
  thresholds: number[]
}> {
  const { data } = await client.get<Envelope<AbsenceWarningRow[]> & { thresholds: number[] }>('/api/absences/warnings', { params })
  return { data: data.data, thresholds: data.thresholds }
}

export async function downloadAbsenceWarningLetter(studentId: number): Promise<Blob> {
  const { data } = await client.get(`/api/absences/warning-letter/${studentId}`, {
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
}

export interface AbsenceCalendarDayStudent {
  student_id: number
  student_name: string | null
  student_number: string | null
  absence_type: string
  reason: string | null
}

export interface AbsenceCalendarDay {
  date: string
  day: number
  is_holiday: boolean
  holiday_name: string | null
  absent_count: number
  total_students: number
  absent_ratio: number
  students: AbsenceCalendarDayStudent[]
}

export interface AbsenceCalendarResponse {
  total_students: number
  student_id: number | null
  days: AbsenceCalendarDay[]
}

export async function fetchAbsenceCalendar(year: number, month: number, studentId?: number | null): Promise<AbsenceCalendarResponse> {
  const { data } = await client.get<Envelope<AbsenceCalendarResponse>>('/api/absences/calendar', {
    params: { year, month, student_id: studentId ?? undefined },
  })
  return data.data
}

export async function exportAbsences(payload: {
  format: ExportFormat
  start_date?: string
  end_date?: string
}): Promise<Blob> {
  const { data } = await client.post('/api/absences/export', payload, { responseType: 'blob', timeout: 60000 })
  return data as Blob
}
