import client from './client'
import type {
  ExamRoom,
  ExamRoomPayload,
  ExamSession,
  ExamSessionPayload,
  ProctorAssignment,
  SeatAssignment,
} from '../types/kelebek'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function listExamRooms(): Promise<ExamRoom[]> {
  const { data } = await client.get<Envelope<ExamRoom[]>>('/api/kelebek/rooms')
  return data.data
}

export async function createExamRoom(tenantId: number, payload: ExamRoomPayload): Promise<ExamRoom> {
  const { data } = await client.post<Envelope<ExamRoom>>('/api/kelebek/rooms', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function deleteExamRoom(id: number): Promise<void> {
  await client.delete(`/api/kelebek/rooms/${id}`)
}

export async function listExamSessions(): Promise<ExamSession[]> {
  const { data } = await client.get<Envelope<ExamSession[]>>('/api/kelebek/sessions')
  return data.data
}

export async function createExamSession(tenantId: number, payload: ExamSessionPayload): Promise<ExamSession> {
  const { data } = await client.post<Envelope<ExamSession>>('/api/kelebek/sessions', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function deleteExamSession(id: number): Promise<void> {
  await client.delete(`/api/kelebek/sessions/${id}`)
}

export async function generateSeating(
  tenantId: number,
  sessionId: number,
  payload: { exam_room_ids: number[]; classroom_ids: number[] },
): Promise<{ assigned: number }> {
  const { data } = await client.post<Envelope<{ assigned: number }>>(
    `/api/kelebek/sessions/${sessionId}/generate-seating`,
    { tenant_id: tenantId, ...payload },
  )
  return data.data
}

export async function fetchSeating(sessionId: number): Promise<SeatAssignment[]> {
  const { data } = await client.get<Envelope<SeatAssignment[]>>(`/api/kelebek/sessions/${sessionId}/seating`)
  return data.data
}

export async function markSeatAttendance(
  sessionId: number,
  entries: { seat_assignment_id: number; present: boolean }[],
): Promise<void> {
  await client.post(`/api/kelebek/sessions/${sessionId}/attendance`, { entries })
}

export async function listProctors(sessionId: number): Promise<ProctorAssignment[]> {
  const { data } = await client.get<Envelope<ProctorAssignment[]>>(`/api/kelebek/sessions/${sessionId}/proctors`)
  return data.data
}

export async function assignProctor(
  tenantId: number,
  sessionId: number,
  payload: { exam_room_id: number; teacher_id: number },
): Promise<ProctorAssignment> {
  const { data } = await client.post<Envelope<ProctorAssignment>>(`/api/kelebek/sessions/${sessionId}/proctors`, {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function removeProctor(sessionId: number, proctorId: number): Promise<void> {
  await client.delete(`/api/kelebek/sessions/${sessionId}/proctors/${proctorId}`)
}

export function seatingExportUrl(sessionId: number, format: ExportFormat): string {
  return `/api/kelebek/sessions/${sessionId}/seating/export?format=${format}`
}

export async function downloadSeatingExport(sessionId: number, format: ExportFormat): Promise<Blob> {
  const { data } = await client.get(seatingExportUrl(sessionId, format), { responseType: 'blob', timeout: 60000 })
  return data as Blob
}
