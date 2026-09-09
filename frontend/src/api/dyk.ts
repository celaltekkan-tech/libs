import client from './client'
import type {
  DykAttendanceSummaryRow,
  DykCourse,
  DykCoursePayload,
  DykEnrollment,
} from '../types/dyk'

interface Envelope<T> {
  success: true
  data: T
}

export async function listDykCourses(): Promise<DykCourse[]> {
  const { data } = await client.get<Envelope<DykCourse[]>>('/api/dyk/courses')
  return data.data
}

export async function createDykCourse(tenantId: number, payload: DykCoursePayload): Promise<DykCourse> {
  const { data } = await client.post<Envelope<DykCourse>>('/api/dyk/courses', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function updateDykCourse(id: number, payload: Partial<DykCoursePayload>): Promise<DykCourse> {
  const { data } = await client.put<Envelope<DykCourse>>(`/api/dyk/courses/${id}`, payload)
  return data.data
}

export async function deleteDykCourse(id: number): Promise<void> {
  await client.delete(`/api/dyk/courses/${id}`)
}

export async function listDykEnrollments(courseId: number): Promise<DykEnrollment[]> {
  const { data } = await client.get<Envelope<DykEnrollment[]>>(`/api/dyk/courses/${courseId}/enrollments`)
  return data.data
}

export async function enrollDykStudents(tenantId: number, courseId: number, studentIds: number[]): Promise<void> {
  await client.post(`/api/dyk/courses/${courseId}/enrollments`, { tenant_id: tenantId, student_ids: studentIds })
}

export async function unenrollDykStudent(courseId: number, studentId: number): Promise<void> {
  await client.delete(`/api/dyk/courses/${courseId}/enrollments/${studentId}`)
}

export async function markDykAttendance(
  tenantId: number,
  courseId: number,
  sessionDate: string,
  entries: { student_id: number; present: boolean }[],
): Promise<void> {
  await client.post(`/api/dyk/courses/${courseId}/attendance`, {
    tenant_id: tenantId,
    session_date: sessionDate,
    entries,
  })
}

export async function fetchDykAttendanceSummary(courseId: number): Promise<{
  data: DykAttendanceSummaryRow[]
  min_attendance_rate: number
}> {
  const { data } = await client.get<Envelope<DykAttendanceSummaryRow[]> & { min_attendance_rate: number }>(
    `/api/dyk/courses/${courseId}/attendance-summary`,
  )
  return { data: data.data, min_attendance_rate: data.min_attendance_rate }
}
