export const CONSENT_TYPE_OPTIONS = [
  { value: 'sms_bilgilendirme', label: 'SMS Bilgilendirme' },
  { value: 'eposta_bilgilendirme', label: 'E-posta Bilgilendirme' },
  { value: 'fotograf_kullanim', label: 'Fotoğraf Kullanımı' },
  { value: 'diger', label: 'Diğer' },
]

export const CONSENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONSENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export interface ParentConsent {
  id: number
  tenant_id: number
  student_id: number
  consent_type: string
  granted: boolean
  granted_at: string | null
  notes: string | null
  Student?: { id: number; first_name: string; last_name: string; student_number: string | null } | null
  created_at: string
  updated_at: string
}
