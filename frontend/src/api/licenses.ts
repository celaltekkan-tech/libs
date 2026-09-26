import client from './client'
import type { CreateLicensePayload, License, LicenseStatus } from '../types/license'

interface Envelope<T> {
  success: true
  data: T
}

export async function listLicenses(params?: {
  tenant_id?: number
  status?: LicenseStatus
}): Promise<License[]> {
  const { data } = await client.get<Envelope<License[]>>('/api/licenses', { params })
  return data.data
}

export async function createLicense(payload: CreateLicensePayload): Promise<License> {
  const { data } = await client.post<Envelope<License>>('/api/licenses', payload)
  return data.data
}

export async function updateLicenseAiLimit(id: number, aiDailyLimit: number | null): Promise<License> {
  const { data } = await client.put<Envelope<License>>(`/api/licenses/${id}/ai-limit`, { ai_daily_limit: aiDailyLimit })
  return data.data
}

export async function cancelLicense(id: number): Promise<License> {
  const { data } = await client.put<Envelope<License>>(`/api/licenses/${id}/cancel`)
  return data.data
}
