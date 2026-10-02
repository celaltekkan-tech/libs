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

export const EXTRA_LESSON_ABSENCE_REASONS = [
  { value: 'rapor', label: 'Rapor', swatch: 'blue' },
  { value: 'izin', label: 'İzin', swatch: 'green' },
  { value: 'gorev', label: 'Görevli', swatch: 'purple' },
  { value: 'mazeret', label: 'Mazeret', swatch: 'gold' },
  { value: 'devamsiz', label: 'Devamsız', swatch: 'red' },
  { value: 'kismi', label: 'Kısmi', swatch: 'orange' },
] as const

export type ExtraLessonAbsenceReason = (typeof EXTRA_LESSON_ABSENCE_REASONS)[number]['value']

export interface ExtraLessonAbsence {
  id: number
  tenant_id: number
  teacher_id: number
  absence_date: string
  reason: ExtraLessonAbsenceReason
  missed_hours: number | null
  note: string | null
}

export interface ExtraLessonPayrollLine {
  code: string
  label: string
  hours: number
}

export interface ExtraLessonPayrollDay {
  date: string
  label: string
  lesson_hours: number
  extra_hours: number
}

export interface ExtraLessonPayrollWeek {
  week: string
  taught: number
  salary?: number
  extra?: number
  social?: number
  prep?: number
  yep?: number
  days: ExtraLessonPayrollDay[]
}

export interface ExtraLessonWeekdayHours {
  day: number
  label: string
  hours: number
}

export interface ExtraLessonPayroll {
  mode: 'ucretli' | 'gorevlendirme'
  weekday_hours: ExtraLessonWeekdayHours[]
  missed_hours: number
  lesson_hours: number
  lines: ExtraLessonPayrollLine[]
  weeks: ExtraLessonPayrollWeek[]
  note: string
}

export interface ExtraLessonMonthlySummaryRow {
  teacher_id: number
  teacher_name: string
  personnel_no: string | null
  total_hours: number
  categories: Record<string, number>
}
