import client from './client'
import type { AttendanceEntry, AttendanceMonthlySummaryRow, AttendanceRecord } from '../types/attendanceRecord'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function listAttendance(params?: {
  teacher_id?: number
  attendance_date?: string
  year?: number
  month?: number
}): Promise<AttendanceRecord[]> {
  const { data } = await client.get<Envelope<AttendanceRecord[]>>('/api/attendance', { params })
  return data.data
}

export async function bulkUpsertAttendance(
  tenantId: number,
  attendanceDate: string,
  entries: AttendanceEntry[],
): Promise<{ count: number }> {
  const { data } = await client.post<Envelope<{ count: number }>>('/api/attendance/bulk', {
    tenant_id: tenantId,
    attendance_date: attendanceDate,
    entries,
  })
  return data.data
}

export async function deleteAttendance(id: number): Promise<void> {
  await client.delete(`/api/attendance/${id}`)
}

export async function fetchAttendanceMonthlySummary(year: number, month: number): Promise<AttendanceMonthlySummaryRow[]> {
  const { data } = await client.get<Envelope<AttendanceMonthlySummaryRow[]>>('/api/attendance/monthly-summary', {
    params: { year, month },
  })
  return data.data
}

export async function exportAttendance(payload: { format: ExportFormat; year?: number; month?: number }): Promise<Blob> {
  const { data } = await client.post('/api/attendance/export', payload, { responseType: 'blob', timeout: 60000 })
  return data as Blob
}
