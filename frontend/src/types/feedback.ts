export type FeedbackStatus = 'new' | 'read' | 'resolved' | 'cancelled'

/** Liste filtrelerinde kullanılan gruplar */
export type FeedbackStatusFilter = FeedbackStatus | 'pending' | 'all'

export interface FeedbackAttachment {
  id: number
  original_name: string
  mime_type: string
  size_bytes: number
  created_at?: string
}

export interface Feedback {
  id: number
  tenant_id: number
  user_id: number | null
  message: string
  status: FeedbackStatus
  reply: string | null
  replied_at: string | null
  created_at: string
  updated_at: string
  Tenant?: { id: number; name: string } | null
  User?: { id: number; full_name: string; email?: string } | null
  Attachments?: FeedbackAttachment[]
}

export interface FeedbackListParams {
  status?: Exclude<FeedbackStatusFilter, 'all'>
  tenant_id?: number
  from?: string
  to?: string
}

export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, { text: string; color: string }> = {
  new: { text: 'Yeni', color: 'blue' },
  read: { text: 'İnceleniyor', color: 'gold' },
  resolved: { text: 'Sonuçlandı', color: 'green' },
  cancelled: { text: 'İptal edildi', color: 'default' },
}

export const FEEDBACK_FILTER_OPTIONS: Array<{ value: FeedbackStatusFilter; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'pending', label: 'Bekleyenler' },
  { value: 'resolved', label: 'Sonuçlananlar' },
  { value: 'cancelled', label: 'İptal edilenler' },
]

export const FEEDBACK_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isPdfAttachment(att: Pick<FeedbackAttachment, 'mime_type' | 'original_name'>): boolean {
  return att.mime_type === 'application/pdf' || att.original_name.toLowerCase().endsWith('.pdf')
}
