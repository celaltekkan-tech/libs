import client from './client'
import type { ApplyPromotionPayload, PromotionHistory, Teacher, TeacherPayload } from '../types/teacher'
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

export async function applyPromotion(
  teacherId: number,
  payload: ApplyPromotionPayload,
): Promise<{ teacher: Teacher; history: PromotionHistory }> {
  const { data } = await client.post<Envelope<{ teacher: Teacher; history: PromotionHistory }>>(
    `/api/teachers/${teacherId}/promotions`,
    payload,
  )
  return data.data
}

export async function fetchPromotionHistory(teacherId: number): Promise<PromotionHistory[]> {
  const { data } = await client.get<Envelope<PromotionHistory[]>>(`/api/teachers/${teacherId}/promotions`)
  return data.data
}

export async function downloadPromotionForm(historyId: number): Promise<Blob> {
  const { data } = await client.get(`/api/teachers/promotions/${historyId}/export-form`, {
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
}

export async function downloadSalaryChangeForm(month: number, year: number): Promise<Blob> {
  const { data } = await client.get('/api/teachers/promotions/salary-form/export', {
    params: { month, year },
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
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

export interface MebbisImportRow {
  row_index: number
  il_ilce: string | null
  kurum_adi: string | null
  kurum_kodu: string | null
  kurum_baslama_tarihi: string | null
  first_name: string
  last_name: string
  national_id: string | null
  unvan: string | null
  gorev: string | null
  brans: string | null
  seviye_unvani: string | null
  personnel_type: string
  ogrenim_durumu: string | null
  kurum_sicil_no: string | null
  emekli_sicil_no: string | null
  arsiv_no: string | null
  cinsiyet: string | null
  kan_grubu: string | null
  dogum_tarihi: string | null
  ilk_gorev_tarihi: string | null
  durum: string | null
  kademe: number | null
  derece: number | null
  matched_teacher_id: number | null
  union_name: string | null
  include?: boolean
}

export async function previewMebbisImport(file: File): Promise<MebbisImportRow[]> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<Envelope<MebbisImportRow[]>>('/api/teachers/import/mebbis/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data.data
}

export interface MebbisImportCommitResult {
  created: number
  updated: number
  total: number
}

export async function commitMebbisImport(
  schoolId: number,
  rows: MebbisImportRow[],
): Promise<MebbisImportCommitResult> {
  const { data } = await client.post<Envelope<MebbisImportCommitResult>>(
    '/api/teachers/import/mebbis/commit',
    { school_id: schoolId, rows },
    { timeout: 60000 },
  )
  return data.data
}
