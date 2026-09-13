export const ABSENCE_TYPE_OPTIONS = [
  { value: 'mazeretsiz', label: 'Mazeretsiz' },
  { value: 'mazeretli', label: 'Mazeretli' },
  { value: 'raporlu', label: 'Raporlu' },
  { value: 'yarim_gun', label: 'Yarım Gün' },
]

export const ABSENCE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ABSENCE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const ABSENCE_TYPE_COLORS: Record<string, string> = {
  mazeretsiz: 'red',
  mazeretli: 'blue',
  raporlu: 'purple',
  yarim_gun: 'orange',
}

// Devamsızlık eşiği/toplamı hesaplanırken kullanılan ağırlık: mazeretsiz gün
// tam, yarım gün 0.5 sayılır (iki yarım gün bir tam gün eder); mazeretli ve
// raporlu günler toplam devamsızlığa dahil edilmez.
export const ABSENCE_TYPE_WEIGHTS: Record<string, number> = {
  mazeretsiz: 1,
  yarim_gun: 0.5,
  mazeretli: 0,
  raporlu: 0,
}

export interface AbsenceStudent {
  id: number
  first_name: string
  last_name: string
  student_number: string | null
  parent_name: string | null
  parent_phone: string | null
  Classroom?: { id: number; class_level: string; section: string } | null
}

export interface StudentAbsence {
  id: number
  tenant_id: number
  student_id: number
  absence_date: string
  absence_type: string
  reason: string | null
  Student?: AbsenceStudent | null
  created_at: string
  updated_at: string
}

export interface AbsenceEntry {
  student_id: number
  absence_type: string
  reason?: string | null
}

export interface AbsenceWarningRow {
  student_id: number
  student_name: string
  student_number: string | null
  classroom: string | null
  count: number
  threshold_crossed: number | null
}
