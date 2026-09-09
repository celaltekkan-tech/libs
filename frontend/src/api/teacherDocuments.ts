import client from './client'
import type { TeacherDocument, TeacherDocumentPayload } from '../types/teacherDocument'

interface Envelope<T> {
  success: true
  data: T
}

export async function listTeacherDocuments(params?: { teacher_id?: number; doc_type?: string; status?: string }): Promise<TeacherDocument[]> {
  const { data } = await client.get<Envelope<TeacherDocument[]>>('/api/teacher-documents', { params })
  return data.data
}

export async function createTeacherDocument(tenantId: number, payload: TeacherDocumentPayload): Promise<TeacherDocument> {
  const { data } = await client.post<Envelope<TeacherDocument>>('/api/teacher-documents', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function updateTeacherDocument(id: number, payload: Partial<TeacherDocumentPayload>): Promise<TeacherDocument> {
  const { data } = await client.put<Envelope<TeacherDocument>>(`/api/teacher-documents/${id}`, payload)
  return data.data
}

export async function reviewTeacherDocument(
  id: number,
  payload: { status: string; reviewer_note?: string | null },
): Promise<TeacherDocument> {
  const { data } = await client.post<Envelope<TeacherDocument>>(`/api/teacher-documents/${id}/review`, payload)
  return data.data
}

export async function duplicateTeacherDocument(id: number, tenantId: number, academicYear: string): Promise<TeacherDocument> {
  const { data } = await client.post<Envelope<TeacherDocument>>(`/api/teacher-documents/${id}/duplicate`, {
    tenant_id: tenantId,
    academic_year: academicYear,
  })
  return data.data
}

export async function deleteTeacherDocument(id: number): Promise<void> {
  await client.delete(`/api/teacher-documents/${id}`)
}
