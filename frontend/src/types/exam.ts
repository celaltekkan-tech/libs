export const EXAM_TYPE_OPTIONS = [
  { value: 'yazili', label: 'Yazılı Sınav' },
  { value: 'ortak', label: 'Ortak Sınav' },
  { value: 'telafi', label: 'Telafi Sınavı' },
  { value: 'sorumluluk', label: 'Sorumluluk Sınavı' },
]

export const EXAM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export interface Exam {
  id: number
  tenant_id: number
  school_id: number | null
  classroom_id: number
  subject_id: number
  exam_type: string
  exam_date: string
  start_time: string | null
  duration_minutes: number | null
  notes: string | null
  Classroom?: { id: number; class_level: string; section: string; academic_year: string | null } | null
  Subject?: { id: number; name: string; difficulty_level: string | null } | null
  created_at: string
  updated_at: string
}

export interface ExamPayload {
  school_id?: number | null
  classroom_id: number
  subject_id: number
  exam_type: string
  exam_date: string
  start_time?: string | null
  duration_minutes?: number | null
  notes?: string | null
}
