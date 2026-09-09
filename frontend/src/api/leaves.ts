import client from './client'
import type { LeaveRecord, LeaveRecordPayload, LeaveSummary } from '../types/leaveRecord'
import type { LeaveCalendarResponse } from '../types/leaveCalendar'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export interface LeaveFilters {
  teacher_id?: number
  leave_type?: string
  year?: number
}

export async function listLeaveRecords(params?: LeaveFilters): Promise<LeaveRecord[]> {
  const query: Record<string, string | number> = {}
  if (params?.teacher_id != null) query.teacher_id = params.teacher_id
  if (params?.leave_type) query.leave_type = params.leave_type
  if (params?.year != null) query.year = params.year
  const { data } = await client.get<Envelope<LeaveRecord[]>>('/api/leaves', { params: query })
  return data.data
}

export async function fetchLeaveSummary(teacherId: number, year?: number): Promise<LeaveSummary> {
  const query: Record<string, string | number> = { teacher_id: teacherId }
  if (year != null) query.year = year
  const { data } = await client.get<Envelope<LeaveSummary>>('/api/leaves/summary', { params: query })
  return data.data
}

export async function fetchLeaveCalendar(year: number, month: number): Promise<LeaveCalendarResponse> {
  const { data } = await client.get<Envelope<LeaveCalendarResponse>>('/api/leaves/calendar', {
    params: { year, month },
  })
  return data.data
}

export async function createLeaveRecord(tenantId: number, payload: LeaveRecordPayload): Promise<LeaveRecord> {
  const { data } = await client.post<Envelope<LeaveRecord>>('/api/leaves', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateLeaveRecord(id: number, payload: Partial<LeaveRecordPayload>): Promise<LeaveRecord> {
  const { data } = await client.put<Envelope<LeaveRecord>>(`/api/leaves/${id}`, payload)
  return data.data
}

export async function deleteLeaveRecord(id: number): Promise<void> {
  await client.delete(`/api/leaves/${id}`)
}

export async function exportLeaveRecords(payload: {
  format: ExportFormat
  columns?: string[]
  filters?: LeaveFilters
}): Promise<Blob> {
  const { data } = await client.post('/api/leaves/export', payload, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}
