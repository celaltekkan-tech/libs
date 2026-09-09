import client from './client'
import type { School, SchoolPayload } from '../types/school'

interface Envelope<T> {
  success: true
  data: T
}

export async function listSchools(): Promise<School[]> {
  const { data } = await client.get<Envelope<School[]>>('/api/schools')
  return data.data
}

export async function createSchool(tenantId: number, payload: SchoolPayload): Promise<School> {
  const { data } = await client.post<Envelope<School>>('/api/schools', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function updateSchool(id: number, payload: Partial<SchoolPayload>): Promise<School> {
  const { data } = await client.put<Envelope<School>>(`/api/schools/${id}`, payload)
  return data.data
}

export async function deleteSchool(id: number): Promise<void> {
  await client.delete(`/api/schools/${id}`)
}
