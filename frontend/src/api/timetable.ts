import client from './client'
import type {
  AiProposal,
  CheckResult,
  ConstraintInput,
  TimetableAssignment,
  TimetableAssignmentPayload,
  TimetableConstraint,
  TimetableLesson,
  TimetableMeta,
  TimetableProject,
  TimetableProjectPayload,
  TimetableRoom,
  TimetableRun,
} from '../types/timetable'

interface Envelope<T> {
  success: true
  data: T
}

const BASE = '/api/timetable'

export async function fetchTimetableMeta(): Promise<TimetableMeta> {
  const { data } = await client.get<Envelope<TimetableMeta>>(`${BASE}/meta`)
  return data.data
}

// ---- projeler
export async function listTimetableProjects(schoolId?: number | null): Promise<TimetableProject[]> {
  const { data } = await client.get<Envelope<TimetableProject[]>>(`${BASE}/projects`, {
    params: schoolId ? { school_id: schoolId } : undefined,
  })
  return data.data
}

export async function getTimetableProject(id: number): Promise<TimetableProject> {
  const { data } = await client.get<Envelope<TimetableProject>>(`${BASE}/projects/${id}`)
  return data.data
}

export async function createTimetableProject(payload: TimetableProjectPayload): Promise<TimetableProject> {
  const { data } = await client.post<Envelope<TimetableProject>>(`${BASE}/projects`, payload)
  return data.data
}

export async function updateTimetableProject(id: number, payload: TimetableProjectPayload): Promise<TimetableProject> {
  const { data } = await client.put<Envelope<TimetableProject>>(`${BASE}/projects/${id}`, payload)
  return data.data
}

export async function deleteTimetableProject(id: number): Promise<void> {
  await client.delete(`${BASE}/projects/${id}`)
}

// ---- mekanlar
export async function listTimetableRooms(schoolId: number): Promise<TimetableRoom[]> {
  const { data } = await client.get<Envelope<TimetableRoom[]>>(`${BASE}/rooms`, { params: { school_id: schoolId } })
  return data.data
}

export async function createTimetableRoom(payload: Partial<TimetableRoom> & { school_id: number }): Promise<TimetableRoom> {
  const { data } = await client.post<Envelope<TimetableRoom>>(`${BASE}/rooms`, payload)
  return data.data
}

export async function updateTimetableRoom(id: number, payload: Partial<TimetableRoom>): Promise<TimetableRoom> {
  const { data } = await client.put<Envelope<TimetableRoom>>(`${BASE}/rooms/${id}`, payload)
  return data.data
}

export async function deleteTimetableRoom(id: number): Promise<void> {
  await client.delete(`${BASE}/rooms/${id}`)
}

// ---- ders atamaları
export async function listTimetableAssignments(projectId: number): Promise<TimetableAssignment[]> {
  const { data } = await client.get<Envelope<TimetableAssignment[]>>(`${BASE}/projects/${projectId}/assignments`)
  return data.data
}

export async function createTimetableAssignment(
  projectId: number,
  payload: TimetableAssignmentPayload,
): Promise<TimetableAssignment> {
  const { data } = await client.post<Envelope<TimetableAssignment>>(`${BASE}/projects/${projectId}/assignments`, payload)
  return data.data
}

export async function updateTimetableAssignment(
  id: number,
  payload: TimetableAssignmentPayload,
): Promise<TimetableAssignment> {
  const { data } = await client.put<Envelope<TimetableAssignment>>(`${BASE}/assignments/${id}`, payload)
  return data.data
}

export async function bulkUpdateTimetableAssignments(
  projectId: number,
  payload: { ids: number[]; teacher_id?: number | null; room_id?: number | null; sync_group?: string | null },
): Promise<number> {
  const { data } = await client.post<Envelope<{ updated: number }>>(`${BASE}/projects/${projectId}/assignments/bulk`, payload)
  return data.data.updated
}

export async function deleteTimetableAssignment(id: number): Promise<void> {
  await client.delete(`${BASE}/assignments/${id}`)
}

export async function generateTimetableAssignments(
  projectId: number,
  overwrite: boolean,
): Promise<{ created: number; skipped: number; without_teacher: number; classrooms: number }> {
  const { data } = await client.post<
    Envelope<{ created: number; skipped: number; without_teacher: number; classrooms: number }>
  >(`${BASE}/projects/${projectId}/assignments/generate`, { overwrite })
  return data.data
}

// ---- kısıtlar
export async function listTimetableConstraints(projectId: number): Promise<TimetableConstraint[]> {
  const { data } = await client.get<Envelope<TimetableConstraint[]>>(`${BASE}/projects/${projectId}/constraints`)
  return data.data
}

export async function createTimetableConstraints(projectId: number, items: ConstraintInput[]): Promise<void> {
  await client.post(`${BASE}/projects/${projectId}/constraints`, { items })
}

export async function updateTimetableConstraint(
  id: number,
  payload: Partial<Pick<TimetableConstraint, 'is_hard' | 'weight' | 'params' | 'is_active'>>,
): Promise<void> {
  await client.put(`${BASE}/constraints/${id}`, payload)
}

export async function deleteTimetableConstraint(id: number): Promise<void> {
  await client.delete(`${BASE}/constraints/${id}`)
}

export async function aiParseConstraints(
  projectId: number,
  text: string,
): Promise<{ proposals: AiProposal[]; unresolved: string[]; usage?: { used: number; limit: number } }> {
  const { data } = await client.post<
    Envelope<{ proposals: AiProposal[]; unresolved: string[]; usage?: { used: number; limit: number } }>
  >(
    `${BASE}/projects/${projectId}/ai/parse`,
    { text },
    { timeout: 60000 },
  )
  return data.data
}

// ---- çözüm
export async function checkTimetable(projectId: number): Promise<CheckResult> {
  const { data } = await client.post<Envelope<CheckResult>>(`${BASE}/projects/${projectId}/check`, null, { timeout: 60000 })
  return data.data
}

export async function startTimetableRun(projectId: number, timeLimit?: number): Promise<TimetableRun> {
  const { data } = await client.post<Envelope<TimetableRun>>(`${BASE}/projects/${projectId}/runs`, {
    time_limit: timeLimit,
  })
  return data.data
}

export async function listTimetableRuns(projectId: number): Promise<TimetableRun[]> {
  const { data } = await client.get<Envelope<TimetableRun[]>>(`${BASE}/projects/${projectId}/runs`)
  return data.data
}

export async function getTimetableRun(id: number): Promise<TimetableRun> {
  const { data } = await client.get<Envelope<TimetableRun>>(`${BASE}/runs/${id}`)
  return data.data
}

export async function cancelTimetableRun(id: number): Promise<void> {
  await client.post(`${BASE}/runs/${id}/cancel`)
}

export async function applyTimetableRun(id: number): Promise<void> {
  await client.post(`${BASE}/runs/${id}/apply`)
}

// ---- taslak dersler
export async function listTimetableLessons(projectId: number): Promise<TimetableLesson[]> {
  const { data } = await client.get<Envelope<TimetableLesson[]>>(`${BASE}/projects/${projectId}/lessons`)
  return data.data
}

export type MoveResult =
  | { ok: true; swappedWith: number | null }
  | { ok: false; conflicts: string[] }

// 409 çakışma listesini hata yerine sonuç olarak döner.
export async function moveTimetableLesson(
  id: number,
  dayOfWeek: number,
  periodNo: number,
  force = false,
): Promise<MoveResult> {
  const res = await client.put<
    { success: true; data: { swapped_with: number | null } } | { success: false; message: string; conflicts: string[] }
  >(
    `${BASE}/lessons/${id}/move`,
    { day_of_week: dayOfWeek, period_no: periodNo, force },
    { validateStatus: (s) => (s >= 200 && s < 300) || s === 409 },
  )
  if (res.data.success) return { ok: true, swappedWith: res.data.data.swapped_with }
  return { ok: false, conflicts: res.data.conflicts || [res.data.message] }
}

export async function setTimetableLessonLock(id: number, isLocked: boolean): Promise<void> {
  await client.put(`${BASE}/lessons/${id}/lock`, { is_locked: isLocked })
}

export async function lockTimetableLessons(
  projectId: number,
  payload: { is_locked: boolean; classroom_id?: number; teacher_id?: number },
): Promise<number> {
  const { data } = await client.post<Envelope<{ updated: number }>>(`${BASE}/projects/${projectId}/lessons/lock`, payload)
  return data.data.updated
}

export async function clearTimetableLessons(projectId: number): Promise<void> {
  await client.delete(`${BASE}/projects/${projectId}/lessons`)
}

export async function publishTimetable(
  projectId: number,
): Promise<{ published: number; classrooms: number; teacher_dropped: number; class_dropped: number }> {
  const { data } = await client.post<
    Envelope<{ published: number; classrooms: number; teacher_dropped: number; class_dropped: number }>
  >(`${BASE}/projects/${projectId}/publish`, null, { timeout: 60000 })
  return data.data
}
