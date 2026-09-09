import client from './client'
import type {
  DutyAssignment,
  DutyAssignmentPayload,
  DutyFairnessReport,
  DutyLocation,
  DutyLocationPayload,
} from '../types/duty'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function listDutyLocations(): Promise<DutyLocation[]> {
  const { data } = await client.get<Envelope<DutyLocation[]>>('/api/duty/locations')
  return data.data
}

export async function createDutyLocation(tenantId: number, payload: DutyLocationPayload): Promise<DutyLocation> {
  const { data } = await client.post<Envelope<DutyLocation>>('/api/duty/locations', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function deleteDutyLocation(id: number): Promise<void> {
  await client.delete(`/api/duty/locations/${id}`)
}

export interface DutyFilters {
  teacher_id?: number
  duty_location_id?: number
  start_date?: string
  end_date?: string
}

export async function listDutyAssignments(params?: DutyFilters): Promise<DutyAssignment[]> {
  const { data } = await client.get<Envelope<DutyAssignment[]>>('/api/duty', { params })
  return data.data
}

export async function createDutyAssignment(tenantId: number, payload: DutyAssignmentPayload): Promise<DutyAssignment> {
  const { data } = await client.post<Envelope<DutyAssignment>>('/api/duty', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateDutyAssignment(
  id: number,
  payload: Partial<DutyAssignmentPayload> & { incident_note?: string | null },
): Promise<DutyAssignment> {
  const { data } = await client.put<Envelope<DutyAssignment>>(`/api/duty/${id}`, payload)
  return data.data
}

export async function deleteDutyAssignment(id: number): Promise<void> {
  await client.delete(`/api/duty/${id}`)
}

export async function generateDutyRoster(
  tenantId: number,
  payload: { start_date: string; end_date: string; duty_location_ids: number[]; include_weekends?: boolean },
): Promise<{ created: number; skipped: { date: string; location: string; reason: string }[] }> {
  const { data } = await client.post<Envelope<{ created: number; skipped: { date: string; location: string; reason: string }[] }>>(
    '/api/duty/generate',
    { tenant_id: tenantId, ...payload },
  )
  return data.data
}

export async function fetchDutyFairness(params?: { start_date?: string; end_date?: string }): Promise<DutyFairnessReport> {
  const { data } = await client.get<Envelope<DutyFairnessReport>>('/api/duty/fairness', { params })
  return data.data
}

export async function exportDuty(payload: {
  format: ExportFormat
  start_date?: string
  end_date?: string
}): Promise<Blob> {
  const { data } = await client.post('/api/duty/export', payload, { responseType: 'blob', timeout: 60000 })
  return data as Blob
}
