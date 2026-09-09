import client from './client'
import type { Exam, ExamPayload } from '../types/exam'
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
