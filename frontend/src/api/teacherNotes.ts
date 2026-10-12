import client from './client'
import type { TeacherNote } from '../types/teacherNote'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function listTeacherNotes(params?: { student_id?: number }): Promise<TeacherNote[]> {
  const { data } = await client.get<Envelope<TeacherNote[]>>('/api/teacher-notes', { params })
  return data.data
}

export async function deleteTeacherNote(id: number): Promise<void> {
  await client.delete(`/api/teacher-notes/${id}`)
}

export async function exportTeacherNotes(payload: {
  format: ExportFormat
  ids?: number[]
}): Promise<Blob> {
  const { data } = await client.post('/api/teacher-notes/export', payload, { responseType: 'blob', timeout: 60000 })
  return data as Blob
}
