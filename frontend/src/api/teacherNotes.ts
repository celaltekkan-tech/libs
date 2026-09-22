import client from './client'
import type { TeacherNote } from '../types/teacherNote'

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
