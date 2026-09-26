import client from './client';
import type { AppNotification } from '../types/api';

interface Envelope<T> {
  success: boolean;
  data: T;
}

export async function listMyNotifications(): Promise<AppNotification[]> {
  const { data } = await client.get<Envelope<AppNotification[]>>('/api/notifications/mine');
  return data.data;
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } = await client.get<Envelope<{ count: number }>>('/api/notifications/unread-count');
  return data.data.count;
}

export async function markNotificationRead(id: number): Promise<void> {
  await client.put(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await client.put('/api/notifications/read-all');
}
