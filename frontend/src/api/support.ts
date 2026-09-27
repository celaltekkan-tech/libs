import client from './client'
import type { Feedback, FeedbackListParams, FeedbackStatus } from '../types/feedback'
import { downloadBlob } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export async function submitSupport(
  message: string,
  files: File[] = [],
  page?: { path?: string | null; title?: string | null },
): Promise<Feedback> {
  const form = new FormData()
  form.append('message', message)
  if (page?.path) form.append('page_path', page.path)
  if (page?.title) form.append('page_title', page.title)
  files.forEach((file) => form.append('files', file))
  const { data } = await client.post<Envelope<Feedback>>('/api/support', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data.data
}

export async function listMySupport(params?: FeedbackListParams): Promise<Feedback[]> {
  const { data } = await client.get<Envelope<Feedback[]>>('/api/support/mine', { params })
  return data.data
}

export async function listSupport(params?: FeedbackListParams): Promise<Feedback[]> {
  const { data } = await client.get<Envelope<Feedback[]>>('/api/support', { params })
  return data.data
}

export async function updateSupport(
  id: number,
  payload: { status?: FeedbackStatus; reply?: string | null },
): Promise<Feedback> {
  const { data } = await client.put<Envelope<Feedback>>(`/api/support/${id}`, payload)
  return data.data
}

export async function deleteSupport(id: number): Promise<void> {
  await client.delete(`/api/support/${id}`)
}

export async function cancelSupport(id: number, cancelReason: string): Promise<Feedback> {
  const { data } = await client.put<Envelope<Feedback>>(`/api/support/${id}/cancel`, {
    cancel_reason: cancelReason,
  })
  return data.data
}

export async function addSupportUpdate(id: number, body: string): Promise<Feedback> {
  const { data } = await client.post<Envelope<Feedback>>(`/api/support/${id}/updates`, { body })
  return data.data
}

export async function fetchSupportAttachmentBlob(attachmentId: number): Promise<Blob> {
  const { data } = await client.get(`/api/support/attachments/${attachmentId}/download`, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}

export async function downloadSupportAttachment(attachmentId: number, filename: string): Promise<void> {
  const blob = await fetchSupportAttachmentBlob(attachmentId)
  downloadBlob(blob, filename)
}

export async function viewSupportAttachment(
  attachmentId: number,
  filename: string,
  inlinePdf: boolean,
): Promise<void> {
  const blob = await fetchSupportAttachmentBlob(attachmentId)
  if (inlinePdf) {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  downloadBlob(blob, filename)
}
