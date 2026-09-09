import client from './client'
import type { SubjectClassHour, SubjectClassHourPayload } from '../types/subject'

interface Envelope<T> {
  success: true
  data: T
}

export async function listSubjectClassHours(subjectId: number): Promise<SubjectClassHour[]> {
  const { data } = await client.get<Envelope<SubjectClassHour[]>>('/api/subject-class-hours', {
    params: { subject_id: subjectId },
  })
  return data.data
}

export async function createSubjectClassHour(tenantId: number, payload: SubjectClassHourPayload): Promise<SubjectClassHour> {
  const { data } = await client.post<Envelope<SubjectClassHour>>('/api/subject-class-hours', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateSubjectClassHour(id: number, weeklyHours: number): Promise<SubjectClassHour> {
  const { data } = await client.put<Envelope<SubjectClassHour>>(`/api/subject-class-hours/${id}`, {
    weekly_hours: weeklyHours,
  })
  return data.data
}

export async function deleteSubjectClassHour(id: number): Promise<void> {
  await client.delete(`/api/subject-class-hours/${id}`)
}
