import client from './client'
import type { AcademicYear, AcademicYearPayload } from '../types/academicYear'

interface Envelope<T> {
  success: true
  data: T
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await client.get<Envelope<AcademicYear[]>>('/api/academic-years')
  return data.data
}

export async function fetchCurrentAcademicYear(): Promise<AcademicYear | null> {
  const { data } = await client.get<Envelope<AcademicYear | null>>('/api/academic-years/current')
  return data.data
}

export async function createAcademicYear(tenantId: number, payload: AcademicYearPayload): Promise<AcademicYear> {
  const { data } = await client.post<Envelope<AcademicYear>>('/api/academic-years', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateAcademicYear(
  id: number,
  payload: Partial<AcademicYearPayload>,
): Promise<AcademicYear> {
  const { data } = await client.put<Envelope<AcademicYear>>(`/api/academic-years/${id}`, payload)
  return data.data
}

export async function deleteAcademicYear(id: number): Promise<void> {
  await client.delete(`/api/academic-years/${id}`)
}
