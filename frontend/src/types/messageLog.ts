export type MessageLogChannel = 'sms' | 'email'
export type MessageLogStatus = 'basarili' | 'basarisiz' | 'iptal'

export interface MessageLog {
  id: number
  tenant_id: number
  channel: MessageLogChannel
  source_module: string
  source_id: number | null
  recipient_label: string | null
  recipient_contact: string | null
  subject: string | null
  body: string | null
  status: MessageLogStatus
  error: string | null
  sent_at: string | null
  created_at: string
}

export interface MessageLogListParams {
  view?: 'visible' | 'hidden'
  channel?: MessageLogChannel
  status?: MessageLogStatus
  q?: string
  page?: number
  pageSize?: number
}

export interface MessageLogListResult {
  data: MessageLog[]
  pagination: { page: number; pageSize: number; total: number }
}

export const CHANNEL_LABELS: Record<MessageLogChannel, string> = {
  sms: 'SMS',
  email: 'E-posta',
}

export const STATUS_LABELS: Record<MessageLogStatus, string> = {
  basarili: 'Başarılı',
  basarisiz: 'Başarısız',
  iptal: 'İptal',
}

export const SOURCE_MODULE_LABELS: Record<string, string> = {
  announcement: 'Veli İletişim / Duyuru',
  work_task_reminder: 'İş Takibi - Hatırlatma',
  work_task_overdue: 'İş Takibi - Gecikme',
}
