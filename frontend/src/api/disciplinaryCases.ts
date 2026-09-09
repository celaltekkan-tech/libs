import client from './client'
import type { DisciplinaryCase, DisciplinaryCasePayload, DisciplinaryStats } from '../types/disciplinaryCase'

interface Envelope<T> {
  success: true
  data: T
}

export async function listDisciplinaryCases(params?: { student_id?: number; status?: string }): Promise<DisciplinaryCase[]> {
  const { data } = await client.get<Envelope<DisciplinaryCase[]>>('/api/disciplinary-cases', { params })
  return data.data
}

export async function createDisciplinaryCase(tenantId: number, payload: DisciplinaryCasePayload): Promise<DisciplinaryCase> {
  const { data } = await client.post<Envelope<DisciplinaryCase>>('/api/disciplinary-cases', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function updateDisciplinaryCase(
  id: number,
  payload: Partial<DisciplinaryCasePayload> & { status?: string; decision_date?: string | null; decision_summary?: string | null },
): Promise<DisciplinaryCase> {
  const { data } = await client.put<Envelope<DisciplinaryCase>>(`/api/disciplinary-cases/${id}`, payload)
  return data.data
}

export async function deleteDisciplinaryCase(id: number): Promise<void> {
  await client.delete(`/api/disciplinary-cases/${id}`)
}

export async function fetchDisciplinaryStats(): Promise<DisciplinaryStats> {
  const { data } = await client.get<Envelope<DisciplinaryStats>>('/api/disciplinary-cases/stats')
  return data.data
}

export type DisciplinaryDocumentType = 'veli_tebligati' | 'savunma_istemi' | 'karar_bildirimi'

export async function downloadDisciplinaryDocument(id: number, type: DisciplinaryDocumentType): Promise<Blob> {
  const { data } = await client.get(`/api/disciplinary-cases/${id}/document`, {
    params: { type },
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
}
