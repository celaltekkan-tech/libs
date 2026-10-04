import client from './client'
import type {
  DirectorySchool,
  DirectorySchoolListMeta,
  DirectorySchoolType,
  District,
  Province,
} from '../types/geo'

interface Envelope<T> {
  success: true
  data: T
  meta?: DirectorySchoolListMeta
}

export async function listProvinces(): Promise<Province[]> {
  const { data } = await client.get<Envelope<Province[]>>('/api/geo/provinces')
  return data.data
}

export async function listDistricts(provinceId: number): Promise<District[]> {
  const { data } = await client.get<Envelope<District[]>>('/api/geo/districts', {
    params: { province_id: provinceId },
  })
  return data.data
}

export async function listDirectorySchools(params: {
  province_id?: number
  district_id?: number
  school_type?: DirectorySchoolType
  q?: string
  limit?: number
  offset?: number
}): Promise<{ rows: DirectorySchool[]; meta: DirectorySchoolListMeta }> {
  const { data } = await client.get<Envelope<DirectorySchool[]>>('/api/geo/directory-schools', {
    params,
  })
  return {
    rows: data.data,
    meta: data.meta || { total: data.data.length, limit: params.limit || 20, offset: params.offset || 0 },
  }
}

export interface DirectorySchoolPayload {
  name: string
  province_id: number
  district_id?: number | null
  school_type: DirectorySchoolType
  code?: string | null
  website?: string | null
}

export async function createDirectorySchool(payload: DirectorySchoolPayload): Promise<DirectorySchool> {
  const { data } = await client.post<Envelope<DirectorySchool>>('/api/geo/directory-schools', payload)
  return data.data
}

export async function updateDirectorySchool(
  id: number,
  payload: DirectorySchoolPayload,
): Promise<DirectorySchool> {
  const { data } = await client.put<Envelope<DirectorySchool>>(`/api/geo/directory-schools/${id}`, payload)
  return data.data
}

export async function deleteDirectorySchool(id: number): Promise<void> {
  await client.delete(`/api/geo/directory-schools/${id}`)
}

export async function fetchDirectorySchoolLogoBlob(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/geo/directory-schools/${id}/logo`, {
    responseType: 'blob',
    timeout: 25000,
  })
  return data as Blob
}
