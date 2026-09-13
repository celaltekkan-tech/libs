import client from './client'
import type { ScheduleEntry, ScheduleEntryPayload, TeacherLoadRow } from '../types/scheduleEntry'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export interface ScheduleFilters {
  classroom_id?: number
  teacher_id?: number
  school_id?: number
  academic_year?: string
  day_of_week?: number
}

export async function listScheduleEntries(params?: ScheduleFilters): Promise<ScheduleEntry[]> {
  const query: Record<string, string | number> = {}
  if (params?.classroom_id != null) query.classroom_id = params.classroom_id
  if (params?.teacher_id != null) query.teacher_id = params.teacher_id
  if (params?.school_id != null) query.school_id = params.school_id
  if (params?.academic_year) query.academic_year = params.academic_year
  if (params?.day_of_week != null) query.day_of_week = params.day_of_week
  const { data } = await client.get<Envelope<ScheduleEntry[]>>('/api/schedule', { params: query })
  return data.data
}

export async function createScheduleEntry(
  tenantId: number,
  payload: ScheduleEntryPayload,
): Promise<{ entry: ScheduleEntry; hoursWarning: string | null }> {
  const { data } = await client.post<Envelope<ScheduleEntry> & { hours_warning?: string | null }>('/api/schedule', {
    tenant_id: tenantId,
    ...payload,
  })
  return { entry: data.data, hoursWarning: data.hours_warning ?? null }
}

export async function updateScheduleEntry(
  id: number,
  payload: Partial<ScheduleEntryPayload>,
): Promise<{ entry: ScheduleEntry; hoursWarning: string | null }> {
  const { data } = await client.put<Envelope<ScheduleEntry> & { hours_warning?: string | null }>(
    `/api/schedule/${id}`,
    payload,
  )
  return { entry: data.data, hoursWarning: data.hours_warning ?? null }
}

export async function deleteScheduleEntry(id: number): Promise<{ hoursWarning: string | null }> {
  const { data } = await client.delete<{ success: true; hours_warning?: string | null }>(`/api/schedule/${id}`)
  return { hoursWarning: data.hours_warning ?? null }
}

export interface HoursCheckRow {
  subject_id: number
  subject_name: string
  required_hours: number
  scheduled_hours: number
  status: 'tam' | 'fazla' | 'eksik'
}

export async function fetchHoursCheck(classroomId: number, academicYear?: string): Promise<HoursCheckRow[]> {
  const { data } = await client.get<Envelope<HoursCheckRow[]>>('/api/schedule/hours-check', {
    params: { classroom_id: classroomId, academic_year: academicYear },
  })
  return data.data
}

export async function fetchTeacherLoad(params?: { academic_year?: string }): Promise<TeacherLoadRow[]> {
  const query: Record<string, string> = {}
  if (params?.academic_year) query.academic_year = params.academic_year
  const { data } = await client.get<Envelope<TeacherLoadRow[]>>('/api/schedule/teacher-load', { params: query })
  return data.data
}

export async function exportSchedule(payload: {
  format: ExportFormat
  columns?: string[]
  filters?: ScheduleFilters
}): Promise<Blob> {
  const { data } = await client.post('/api/schedule/export', payload, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}

export interface ScheduleTeacherOption {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
  subject_ids: number[]
  classroom_ids: number[]
  subject_names: string[]
}

export async function listScheduleTeachers(params?: {
  classroom_id?: number
  subject_id?: number
  day_of_week?: number
  academic_year?: string
}): Promise<ScheduleTeacherOption[]> {
  const { data } = await client.get<Envelope<ScheduleTeacherOption[]>>('/api/schedule/teachers', {
    params,
  })
  return data.data
}

export interface ScheduleImportPreview {
  sheet_names: string[]
  sheet_name: string
  header_row: number
  headers: { index: number; label: string }[]
  suggested_mapping: Record<string, string>
  sample_rows: { row: number; values: Record<string, string | null> }[]
  importable_fields: { key: string; label: string; required: boolean }[]
  total_rows: number
}

export interface ScheduleImportResult {
  created: number
  updated: number
  skipped: number
  error_count: number
  errors: { row: number; message: string }[]
}

export async function previewScheduleImport(
  file: File,
  options?: { headerRow?: number | null },
): Promise<ScheduleImportPreview> {
  const form = new FormData()
  form.append('file', file)
  if (options?.headerRow != null) form.append('header_row', String(options.headerRow))
  const { data } = await client.post<Envelope<ScheduleImportPreview>>(
    '/api/schedule/import/preview',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 },
  )
  return data.data
}

export async function importSchedule(
  file: File,
  options?: {
    headerRow?: number | null
    columnMapping?: Record<string, string>
    replaceExisting?: boolean
    academicYear?: string | null
  },
): Promise<ScheduleImportResult> {
  const form = new FormData()
  form.append('file', file)
  if (options?.headerRow != null) form.append('header_row', String(options.headerRow))
  if (options?.columnMapping) form.append('column_mapping', JSON.stringify(options.columnMapping))
  if (options?.replaceExisting) form.append('replace_existing', 'true')
  if (options?.academicYear) form.append('academic_year', options.academicYear)
  const { data } = await client.post<Envelope<ScheduleImportResult>>('/api/schedule/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
  return data.data
}
