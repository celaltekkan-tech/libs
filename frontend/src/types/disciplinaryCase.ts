export const SANCTION_LEVEL_OPTIONS = [
  { value: 'uyari', label: 'Uyarı' },
  { value: 'kinama', label: 'Kınama' },
  { value: 'okuldan_kisa_sureli_uzaklastirma', label: 'Okuldan Kısa Süreli Uzaklaştırma' },
  { value: 'okuldan_uzun_sureli_uzaklastirma', label: 'Okuldan Uzun Süreli Uzaklaştırma' },
  { value: 'okul_degistirme', label: 'Okul Değiştirme' },
]

export const SANCTION_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  SANCTION_LEVEL_OPTIONS.map((o) => [o.value, o.label]),
)

export const CASE_STATUS_OPTIONS = [
  { value: 'acik', label: 'Açık' },
  { value: 'karara_baglandi', label: 'Karara Bağlandı' },
  { value: 'itiraz', label: 'İtiraz' },
  { value: 'kapandi', label: 'Kapandı' },
]

export const CASE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CASE_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export interface DisciplinaryCaseStudent {
  id: number
  first_name: string
  last_name: string
  student_number: string | null
  Classroom?: { id: number; class_level: string; section: string } | null
}

export interface DisciplinaryCase {
  id: number
  tenant_id: number
  student_id: number
  incident_date: string
  description: string
  sanction_level: string | null
  status: string
  decision_date: string | null
  decision_summary: string | null
  notes: string | null
  Student?: DisciplinaryCaseStudent | null
  created_at: string
  updated_at: string
}

export interface DisciplinaryCasePayload {
  student_id: number
  incident_date: string
  description: string
  sanction_level?: string | null
  notes?: string | null
}

export interface DisciplinaryStats {
  total: number
  by_sanction: Record<string, number>
  by_status: Record<string, number>
}
