import client from './client'
import type { Feedback, FeedbackListParams, FeedbackStatus } from '../types/feedback'
import { downloadBlob } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function submitFeedback(message: string, files: File[] = []): Promise<Feedback> {
  const form = new FormData()
  form.append('message', message)
  files.forEach((file) => form.append('files', file))
  const { data } = await client.post<Envelope<Feedback>>('/api/feedback', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data.data
}

export async function listMyFeedback(params?: FeedbackListParams): Promise<Feedback[]> {
  const { data } = await client.get<Envelope<Feedback[]>>('/api/feedback/mine', { params })
  return data.data
}

export async function listFeedback(params?: FeedbackListParams): Promise<Feedback[]> {
  const { data } = await client.get<Envelope<Feedback[]>>('/api/feedback', { params })
  return data.data
}

export async function updateFeedback(
  id: number,
  payload: { status?: FeedbackStatus; reply?: string },
): Promise<Feedback> {
  const { data } = await client.put<Envelope<Feedback>>(`/api/feedback/${id}`, payload)
  return data.data
}

export async function deleteFeedback(id: number): Promise<void> {
  await client.delete(`/api/feedback/${id}`)
}

export async function fetchFeedbackAttachmentBlob(attachmentId: number): Promise<Blob> {
  const { data } = await client.get(`/api/feedback/attachments/${attachmentId}/download`, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}

export async function downloadFeedbackAttachment(
  attachmentId: number,
  filename: string,
): Promise<void> {
  const blob = await fetchFeedbackAttachmentBlob(attachmentId)
  downloadBlob(blob, filename)
}

export async function viewFeedbackAttachment(
  attachmentId: number,
  filename: string,
  inlinePdf: boolean,
): Promise<void> {
  const blob = await fetchFeedbackAttachmentBlob(attachmentId)
  if (inlinePdf) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  downloadBlob(blob, filename)
}
