export const CHANNEL_OPTIONS = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'E-posta' },
  { value: 'both', label: 'SMS + E-posta' },
]

export const TARGET_TYPE_OPTIONS = [
  { value: 'all', label: 'Tüm öğrenciler' },
  { value: 'class_level', label: 'Sınıf seviyesi' },
  { value: 'classroom', label: 'Sınıf / şube' },
  { value: 'student', label: 'Belirli öğrenciler' },
]

export interface Announcement {
  id: number
  tenant_id: number
  created_by: number | null
  title: string
  body: string
  channel: string
  target_type: string
  target_ids: (string | number)[] | null
  recipient_count: number
  status: string
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface AnnouncementPayload {
  title: string
  body: string
  channel: string
  target_type: string
  target_ids?: (string | number)[]
}
