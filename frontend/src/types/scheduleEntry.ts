export const DAY_OPTIONS = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
]

export const DAY_LABELS: Record<number, string> = Object.fromEntries(
  DAY_OPTIONS.map((d) => [d.value, d.label]),
)

export interface ScheduleClassroom {
  id: number
  class_level: string
  section: string
  academic_year: string | null
}

export interface ScheduleSubject {
  id: number
  name: string
  code: string | null
}

export interface ScheduleTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
}

export interface ScheduleEntry {
  id: number
  tenant_id: number
  school_id: number | null
  classroom_id: number
  subject_id: number
  teacher_id: number | null
  day_of_week: number
  period_no: number
  academic_year: string | null
  Classroom?: ScheduleClassroom | null
  Subject?: ScheduleSubject | null
  Teacher?: ScheduleTeacher | null
  created_at: string
  updated_at: string
}

export interface ScheduleEntryPayload {
  school_id?: number | null
  classroom_id: number
  subject_id: number
  teacher_id?: number | null
  day_of_week: number
  period_no: number
  academic_year?: string | null
}

export interface TeacherLoadRow {
  teacher_id: number
  teacher_name: string
  personnel_no: string | null
  total_hours: number
  subjects: { name: string; hours: number }[]
}
