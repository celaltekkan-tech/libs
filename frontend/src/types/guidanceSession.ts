export const SESSION_TYPE_OPTIONS = [
  { value: 'bireysel', label: 'Bireysel Görüşme' },
  { value: 'grup', label: 'Grup Rehberliği' },
  { value: 'veli_gorusmesi', label: 'Veli Görüşmesi' },
  { value: 'yonlendirme', label: 'Yönlendirme' },
]

export const SESSION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SESSION_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const REFERRAL_OPTIONS = [
  { value: 'RAM', label: 'RAM (Rehberlik ve Araştırma Merkezi)' },
  { value: 'saglik_kurulusu', label: 'Sağlık Kuruluşu' },
  { value: 'sosyal_hizmet', label: 'Sosyal Hizmetler' },
]

export const REFERRAL_LABELS: Record<string, string> = Object.fromEntries(
  REFERRAL_OPTIONS.map((o) => [o.value, o.label]),
)

export interface GuidanceSession {
  id: number
  tenant_id: number
  student_id: number
  created_by: number | null
  session_date: string
  session_type: string
  summary: string
  referral_to: string | null
  Student?: { id: number; first_name: string; last_name: string; student_number: string | null } | null
  created_at: string
  updated_at: string
}

export interface GuidanceSessionPayload {
  student_id: number
  session_date: string
  session_type: string
  summary: string
  referral_to?: string | null
}

export interface GuidanceStats {
  total: number
  by_type: Record<string, number>
  by_referral: Record<string, number>
}
