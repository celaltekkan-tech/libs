export interface NotificationSender {
  id: number
  full_name: string
  email?: string
}

export interface AppNotification {
  id: number
  recipient_user_id: number
  tenant_id: number | null
  sender_user_id: number | null
  title: string
  body: string
  read_at: string | null
  created_at: string
  updated_at: string
  Sender?: NotificationSender | null
  Tenant?: { id: number; name: string } | null
  Recipient?: { id: number; full_name: string; email?: string; tenant_id?: number } | null
}

export type NotificationTargetType = 'users' | 'tenant' | 'all_tenants'

export interface CreateNotificationPayload {
  title: string
  body: string
  target_type: NotificationTargetType
  tenant_id?: number | null
  user_ids?: number[]
}
