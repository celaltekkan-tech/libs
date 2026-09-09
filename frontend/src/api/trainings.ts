import client from './client'
import type { TrainingRecord, TrainingRecordPayload } from '../types/trainingRecord'

interface Envelope<T> {
  success: true
  data: T
}

export async function listTrainings(params?: { teacher_id?: number }): Promise<TrainingRecord[]> {
  const query: Record<string, number> = {}
  if (params?.teacher_id != null) query.teacher_id = params.teacher_id
  const { data } = await client.get<Envelope<TrainingRecord[]>>('/api/trainings', { params: query })
  return data.data
}

export async function createTraining(tenantId: number, payload: TrainingRecordPayload): Promise<TrainingRecord> {
  const { data } = await client.post<Envelope<TrainingRecord>>('/api/trainings', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateTraining(
  id: number,
  payload: Partial<TrainingRecordPayload>,
): Promise<TrainingRecord> {
  const { data } = await client.put<Envelope<TrainingRecord>>(`/api/trainings/${id}`, payload)
  return data.data
}

export async function deleteTraining(id: number): Promise<void> {
  await client.delete(`/api/trainings/${id}`)
}
