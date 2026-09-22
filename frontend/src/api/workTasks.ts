import client from './client'
import type { WorkTask, WorkTaskListParams, WorkTaskPayload } from '../types/workTask'

interface Envelope<T> {
  success: true
  data: T
}

export async function listWorkTasks(params: WorkTaskListParams = {}): Promise<WorkTask[]> {
  const { data } = await client.get<Envelope<WorkTask[]>>('/api/work-tasks', { params })
  return data.data
}

export async function getWorkTask(id: number): Promise<WorkTask> {
  const { data } = await client.get<Envelope<WorkTask>>(`/api/work-tasks/${id}`)
  return data.data
}

export async function createWorkTask(payload: WorkTaskPayload): Promise<WorkTask> {
  const { data } = await client.post<Envelope<WorkTask>>('/api/work-tasks', payload)
  return data.data
}

export async function updateWorkTask(id: number, payload: Partial<WorkTaskPayload>): Promise<WorkTask> {
  const { data } = await client.put<Envelope<WorkTask>>(`/api/work-tasks/${id}`, payload)
  return data.data
}

export async function completeWorkTask(id: number): Promise<WorkTask> {
  const { data } = await client.post<Envelope<WorkTask>>(`/api/work-tasks/${id}/complete`)
  return data.data
}

export async function pauseWorkTask(id: number): Promise<WorkTask> {
  const { data } = await client.post<Envelope<WorkTask>>(`/api/work-tasks/${id}/pause`)
  return data.data
}

export async function resumeWorkTask(id: number): Promise<WorkTask> {
  const { data } = await client.post<Envelope<WorkTask>>(`/api/work-tasks/${id}/resume`)
  return data.data
}

export async function deleteWorkTask(id: number): Promise<void> {
  await client.delete(`/api/work-tasks/${id}`)
}
