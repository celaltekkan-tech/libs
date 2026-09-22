import client from './client'
import type {
  CommitteeMember,
  Exam,
  ExamPayload,
  ResponsibilityExamItem,
  SorumlulukImportPreview,
  SorumlulukImportPreviewRow,
} from '../types/exam'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
  warning?: string | null
}

export async function listExams(params?: { classroom_id?: number; start_date?: string; end_date?: string }): Promise<Exam[]> {
  const { data } = await client.get<Envelope<Exam[]>>('/api/exams', { params })
  return data.data
}

export async function createExam(tenantId: number, payload: ExamPayload): Promise<{ exam: Exam; warning: string | null }> {
  const { data } = await client.post<Envelope<Exam>>('/api/exams', { tenant_id: tenantId, ...payload })
  return { exam: data.data, warning: data.warning ?? null }
}

export async function updateExam(id: number, payload: Partial<ExamPayload>): Promise<Exam> {
  const { data } = await client.put<Envelope<Exam>>(`/api/exams/${id}`, payload)
  return data.data
}

export async function deleteExam(id: number): Promise<void> {
  await client.delete(`/api/exams/${id}`)
}

export async function exportExams(payload: { format: ExportFormat; start_date?: string; end_date?: string }): Promise<Blob> {
  const { data } = await client.post('/api/exams/export', payload, { responseType: 'blob', timeout: 60000 })
  return data as Blob
}

export async function listSorumlulukItems(): Promise<ResponsibilityExamItem[]> {
  const { data } = await client.get<Envelope<ResponsibilityExamItem[]>>('/api/exams/sorumluluk')
  return data.data
}

export async function previewSorumlulukImport(file: File): Promise<SorumlulukImportPreview> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<Envelope<SorumlulukImportPreview>>(
    '/api/exams/sorumluluk/import/preview',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    },
  )
  return data.data
}

export interface SorumlulukImportCommitResult {
  created: number
  preserved: number
  skipped_duplicates: number
  created_subjects: number
  created_subject_names: string[]
}

export async function commitSorumlulukImport(
  schoolId: number | null,
  rows: SorumlulukImportPreviewRow[],
): Promise<SorumlulukImportCommitResult> {
  const { data } = await client.post<Envelope<SorumlulukImportCommitResult>>(
    '/api/exams/sorumluluk/import/commit',
    {
      school_id: schoolId,
      rows: rows.map((r) => ({
        student_number: r.student_number,
        student_name: r.student_name,
        current_class_level: r.current_class_level,
        current_section: r.current_section,
        subject_class_level: r.subject_class_level,
        subject_name: r.subject_name,
        student_id: r.student_id,
        classroom_id: r.classroom_id,
        school_id: r.school_id,
        subject_id: r.subject_id,
      })),
    },
    { timeout: 60000 },
  )
  return data.data
}

export async function createSorumlulukItem(payload: {
  student_id: number
  subject_class_level: string
  subject_id?: number | null
  subject_name?: string | null
}): Promise<ResponsibilityExamItem> {
  const { data } = await client.post<Envelope<ResponsibilityExamItem>>('/api/exams/sorumluluk', payload)
  return data.data
}

export async function scheduleSorumlulukSubject(payload: {
  subject_class_level: string
  subject_name: string
  exam_date: string | null
  start_time?: string | null
  oral_exam_date?: string | null
  oral_start_time?: string | null
  duration_minutes?: number | null
  teacher_id?: number | null
  committee_members?: CommitteeMember[] | null
}): Promise<{ items: ResponsibilityExamItem[]; warning: string | null }> {
  const { data } = await client.post<Envelope<ResponsibilityExamItem[]>>('/api/exams/sorumluluk/schedule', payload)
  return { items: data.data, warning: data.warning ?? null }
}

export async function updateSorumlulukItem(
  id: number,
  payload: Partial<Pick<ResponsibilityExamItem, 'exam_date' | 'start_time' | 'duration_minutes' | 'teacher_id' | 'notes'>>,
): Promise<ResponsibilityExamItem> {
  const { data } = await client.put<Envelope<ResponsibilityExamItem>>(`/api/exams/sorumluluk/${id}`, payload)
  return data.data
}

export async function deleteSorumlulukItem(id: number): Promise<void> {
  await client.delete(`/api/exams/sorumluluk/${id}`)
}

export async function deleteAllSorumlulukItems(): Promise<{ deleted: number }> {
  const { data } = await client.delete<Envelope<{ deleted: number }>>('/api/exams/sorumluluk')
  return data.data
}

export async function exportSorumlulukExams(payload: { format: ExportFormat }): Promise<Blob> {
  const { data } = await client.post('/api/exams/sorumluluk/export', payload, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}

