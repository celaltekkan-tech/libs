import client from './client'
import type { Holiday, HolidayPayload } from '../types/holiday'

interface Envelope<T> {
  success: true
  data: T
}

export async function listHolidays(): Promise<Holiday[]> {
  const { data } = await client.get<Envelope<Holiday[]>>('/api/holidays')
  return data.data
}

export async function createHoliday(tenantId: number, payload: HolidayPayload): Promise<Holiday> {
  const { data } = await client.post<Envelope<Holiday>>('/api/holidays', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function deleteHoliday(id: number): Promise<void> {
  await client.delete(`/api/holidays/${id}`)
}

export async function seedDefaultHolidays(): Promise<Holiday[]> {
  const { data } = await client.post<Envelope<Holiday[]>>('/api/holidays/seed-defaults')
  return data.data
}
