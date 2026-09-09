import client from './client'
import type { NormPosition, NormPositionPayload } from '../types/normPosition'

interface Envelope<T> {
  success: true
  data: T
}

export async function listNormPositions(params?: { school_id?: number }): Promise<NormPosition[]> {
  const query: Record<string, number> = {}
  if (params?.school_id != null) query.school_id = params.school_id
  const { data } = await client.get<Envelope<NormPosition[]>>('/api/norm-positions', { params: query })
  return data.data
}

export async function createNormPosition(tenantId: number, payload: NormPositionPayload): Promise<NormPosition> {
  const { data } = await client.post<Envelope<NormPosition>>('/api/norm-positions', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateNormPosition(id: number, payload: Partial<NormPositionPayload>): Promise<NormPosition> {
  const { data } = await client.put<Envelope<NormPosition>>(`/api/norm-positions/${id}`, payload)
  return data.data
}

export async function deleteNormPosition(id: number): Promise<void> {
  await client.delete(`/api/norm-positions/${id}`)
}
