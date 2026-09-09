import client from './client'
import type { Announcement, AnnouncementPayload } from '../types/announcement'

interface Envelope<T> {
  success: true
  data: T
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data } = await client.get<Envelope<Announcement[]>>('/api/announcements')
  return data.data
}

export async function createAnnouncement(tenantId: number, payload: AnnouncementPayload): Promise<Announcement> {
  const { data } = await client.post<Envelope<Announcement>>('/api/announcements', { tenant_id: tenantId, ...payload })
  return data.data
}

export async function markAnnouncementSent(id: number): Promise<Announcement> {
  const { data } = await client.post<Envelope<Announcement>>(`/api/announcements/${id}/mark-sent`)
  return data.data
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await client.delete(`/api/announcements/${id}`)
}

export async function previewRecipients(targetType: string, targetIds: (string | number)[]): Promise<number> {
  const { data } = await client.get<Envelope<{ count: number }>>('/api/announcements/preview-recipients', {
    params: { target_type: targetType, target_ids: targetIds.join(',') },
  })
  return data.data.count
}
