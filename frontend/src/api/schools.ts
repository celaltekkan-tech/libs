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

export async function uploadSchoolLogo(id: number, file: File): Promise<{ logo_url: string | null }> {
  const form = new FormData()
  form.append('logo', file)
  const { data } = await client.post<Envelope<{ logo_url: string | null }>>(`/api/schools/${id}/logo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data.data
}

export async function fetchSchoolLogoBlob(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/schools/${id}/logo`, {
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
}

export async function deleteSchoolLogo(id: number): Promise<void> {
  await client.delete(`/api/schools/${id}/logo`)
}
