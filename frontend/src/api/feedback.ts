import client from './client'
import type { Feedback, FeedbackStatus } from '../types/feedback'

interface Envelope<T> {
  success: true
  data: T
}

export async function submitFeedback(message: string): Promise<Feedback> {
  const { data } = await client.post<Envelope<Feedback>>('/api/feedback', { message })
  return data.data
}

export async function listFeedback(params?: {
  status?: FeedbackStatus
  tenant_id?: number
}): Promise<Feedback[]> {
  const { data } = await client.get<Envelope<Feedback[]>>('/api/feedback', { params })
  return data.data
}

export async function updateFeedbackStatus(id: number, status: FeedbackStatus): Promise<Feedback> {
  const { data } = await client.put<Envelope<Feedback>>(`/api/feedback/${id}`, { status })
  return data.data
}

export async function deleteFeedback(id: number): Promise<void> {
  await client.delete(`/api/feedback/${id}`)
}
