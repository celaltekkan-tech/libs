export type FeedbackStatus = 'new' | 'read' | 'waiting' | 'resolved' | 'cancelled'

/** Liste filtrelerinde kullanılan gruplar */
export type FeedbackStatusFilter = FeedbackStatus | 'all'

/** Kullanıcının gelişme ekleyebileceği aşamalar */
export const REVIEW_FEEDBACK_STATUSES: FeedbackStatus[] = ['read', 'waiting']

/** İptal edilebilir açık kayıtlar */
export const OPEN_FEEDBACK_STATUSES: FeedbackStatus[] = ['new', 'read', 'waiting']

export interface FeedbackAttachment {
  id: number
  original_name: string
  mime_type: string
  size_bytes: number
  created_at?: string
}

export interface FeedbackUpdate {
  id: number
  body: string
  is_from_platform: boolean
  user_id: number | null
  author_name?: string | null
  created_at: string
  User?: { id: number; full_name: string } | null
}

export interface Feedback {
  id: number
  tenant_id: number | null
  user_id: number | null
  message: string
  page_path: string | null
  page_title: string | null
  status: FeedbackStatus
  reply: string | null
  replied_at: string | null
  cancel_reason: string | null
  origin_env?: string | null
  author_name?: string | null
  author_email?: string | null
  tenant_name?: string | null
  created_at: string
  updated_at: string
  Tenant?: { id: number; name: string } | null
  User?: { id: number; full_name: string; email?: string } | null
  Attachments?: FeedbackAttachment[]
  Updates?: FeedbackUpdate[]
}

export interface FeedbackSyncStatus {
  enabled: boolean
  env: string
  peer_configured: boolean
  last_run_at: string | null
  last_success_at: string | null
  last_error: string | null
  last_summary: {
    ok?: boolean
    error?: string
    pulled?: { feedbacks: number; updates: number; attachments: number; tombstones: number; files: number }
    pushed?: { feedbacks: number; updates: number; attachments: number; tombstones: number; files: number }
  } | null
}

export function feedbackTenantLabel(item: Pick<Feedback, 'Tenant' | 'tenant_name' | 'tenant_id'>): string {
  return item.Tenant?.name || item.tenant_name || (item.tenant_id ? `Hesap #${item.tenant_id}` : 'Karşı ortam')
}

export function feedbackAuthorLabel(item: Pick<Feedback, 'User' | 'author_name' | 'author_email'>): string {
  if (item.User) {
    return item.User.email ? `${item.User.full_name} · ${item.User.email}` : item.User.full_name
  }
  if (item.author_name) {
    return item.author_email ? `${item.author_name} · ${item.author_email}` : item.author_name
  }
  return 'Silinmiş kullanıcı'
}

export function feedbackOriginLabel(env: string | null | undefined): string | null {
  if (!env) return null
  if (env === 'prod') return 'Canlı'
  if (env === 'dev') return 'Geliştirme'
  return env
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
  waiting: { text: 'Beklemede', color: 'orange' },
  resolved: { text: 'Sonuçlandı', color: 'green' },
  cancelled: { text: 'İptal edildi', color: 'default' },
}

export const FEEDBACK_FILTER_OPTIONS: Array<{ value: FeedbackStatusFilter; label: string }> = [
  { value: 'new', label: 'Yeni' },
  { value: 'read', label: 'İnceleniyor' },
  { value: 'waiting', label: 'Beklemede' },
  { value: 'resolved', label: 'Sonuçlananlar' },
  { value: 'cancelled', label: 'İptal edilenler' },
  { value: 'all', label: 'Tümü' },
]

export const FEEDBACK_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.png,.jpg,.jpeg,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/gif,image/webp'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isPdfAttachment(att: Pick<FeedbackAttachment, 'mime_type' | 'original_name'>): boolean {
  return att.mime_type === 'application/pdf' || att.original_name.toLowerCase().endsWith('.pdf')
}

export function isImageAttachment(att: Pick<FeedbackAttachment, 'mime_type' | 'original_name'>): boolean {
  return (
    att.mime_type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(att.original_name)
  )
}
