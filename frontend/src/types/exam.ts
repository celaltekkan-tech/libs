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
  teacher_id: number | null
  notes: string | null
  Classroom?: { id: number; class_level: string; section: string; academic_year: string | null } | null
  Subject?: { id: number; name: string; difficulty_level: string | null } | null
  Teacher?: { id: number; first_name: string; last_name: string; personnel_no: string | null } | null
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
  teacher_id?: number | null
  notes?: string | null
}

export interface CommitteeMember {
  teacher_id: number
  role: 'baskan' | 'uye' | 'gozetmen'
}

export interface ResponsibilityExamItem {
  id: number
  tenant_id: number
  school_id: number | null
  student_id: number | null
  classroom_id: number | null
  student_number: string
  student_name: string
  current_class_level: string | null
  current_section: string | null
  subject_class_level: string
  subject_name: string
  subject_id: number | null
  exam_date: string | null
  start_time: string | null
  oral_exam_date: string | null
  oral_start_time: string | null
  duration_minutes: number | null
  teacher_id: number | null
  committee_members: CommitteeMember[] | null
  notes: string | null
  Student?: { id: number; first_name: string; last_name: string; student_number: string | null } | null
  Classroom?: { id: number; class_level: string; section: string; academic_year: string | null } | null
  Subject?: { id: number; name: string; difficulty_level: string | null } | null
  Teacher?: { id: number; first_name: string; last_name: string; personnel_no: string | null } | null
  created_at: string
  updated_at: string
}

export interface SorumlulukImportPreviewRow {
  row_index: number
  student_number: string
  student_name: string
  current_class_level: string | null
  current_section: string | null
  subject_class_level: string
  subject_name: string
  student_id: number | null
  classroom_id: number | null
  school_id: number | null
  subject_id: number | null
  student_matched: boolean
  subject_matched: boolean
  student_match: 'number' | 'name' | null
  name_mismatch: boolean
  matched_student_name: string | null
  matched_subject_name: string | null
}

export interface SorumlulukImportPreview {
  title: string | null
  rows: SorumlulukImportPreviewRow[]
  stats: {
    student_count: number
    row_count: number
    subject_count: number
    unmatched_students: number
    unmatched_subjects: number
    unmatched_subject_names: string[]
  }
}

export function sorumlulukSubjectKey(item: {
  subject_class_level: string
  subject_name: string
}): string {
  return `${item.subject_class_level}|${item.subject_name}`
}

export function sorumlulukSubjectLabel(item: {
  subject_class_level: string
  subject_name: string
}): string {
  return `${item.subject_class_level}. ${item.subject_name}`
}

