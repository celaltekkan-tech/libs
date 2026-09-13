import client from './client'
import type { AppNotification, CreateNotificationPayload } from '../types/notification'

interface Envelope<T> {
  success: true
  data: T
}

export async function listMyNotifications(params?: { unread_only?: boolean }): Promise<AppNotification[]> {
  const { data } = await client.get<Envelope<AppNotification[]>>('/api/notifications/mine', {
    params: params?.unread_only ? { unread_only: true } : undefined,
  })
  return data.data
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } = await client.get<Envelope<{ count: number }>>('/api/notifications/unread-count')
  return data.data.count
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  const { data } = await client.put<Envelope<AppNotification>>(`/api/notifications/${id}/read`)
  return data.data
}

export async function markAllNotificationsRead(): Promise<void> {
  await client.put('/api/notifications/read-all')
}

export async function createNotification(
  payload: CreateNotificationPayload,
): Promise<{ count: number }> {
  const { data } = await client.post<Envelope<{ count: number }>>('/api/notifications', payload)
  return data.data
}

export async function listNotificationRecipientOptions(
  tenantId: number,
): Promise<Array<{ id: number; full_name: string; email: string; tenant_id: number }>> {
  const { data } = await client.get<
    Envelope<Array<{ id: number; full_name: string; email: string; tenant_id: number }>>
  >('/api/notifications/recipient-options', { params: { tenant_id: tenantId } })
  return data.data
}

export async function listSentNotifications(): Promise<AppNotification[]> {
  const { data } = await client.get<Envelope<AppNotification[]>>('/api/notifications/sent')
  return data.data
}
