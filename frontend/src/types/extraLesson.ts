export const EXTRA_LESSON_CATEGORY_OPTIONS = [
  { value: 'ders_yuku', label: 'Ders Yükü' },
  { value: 'nobet', label: 'Nöbet' },
  { value: 'dyk', label: 'DYK' },
  { value: 'egzersiz', label: 'Egzersiz' },
  { value: 'sinav_gorevi', label: 'Sınav Görevi' },
  { value: 'belletici', label: 'Belletici' },
  { value: 'hazirlik_planlama', label: 'Hazırlık / Planlama' },
  { value: 'kesinti', label: 'Kesinti' },
  { value: 'diger', label: 'Diğer' },
]

export const EXTRA_LESSON_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXTRA_LESSON_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
)

export interface ExtraLessonTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
}

export interface ExtraLessonEntry {
  id: number
  tenant_id: number
  teacher_id: number
  year: number
  month: number
  category: string
  hours: string | number
  notes: string | null
  Teacher?: ExtraLessonTeacher | null
  created_at: string
  updated_at: string
}

export interface ExtraLessonPayload {
  teacher_id: number
  year: number
  month: number
  category: string
  hours: number
  notes?: string | null
}

export interface ExtraLessonMonthlySummaryRow {
  teacher_id: number
  teacher_name: string
  personnel_no: string | null
  total_hours: number
  categories: Record<string, number>
}
