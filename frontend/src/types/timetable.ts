export interface TimetableWeights {
  teacher_gaps: number
  class_compact: number
  teacher_single_hour_day: number
  hard_subject_late: number
  soft_constraint: number
}

export interface DayBreak {
  day: number
  after_period: number
  minutes: number
}

export interface BellSchedule {
  start_time: string
  lesson_minutes: number
  break_minutes: number
  day_breaks: DayBreak[]
}

export interface TimetableSettings {
  time_limit: number
  max_subject_daily: number
  weights: TimetableWeights
  bell?: BellSchedule
}

export const DEFAULT_BELL: BellSchedule = {
  start_time: '08:30',
  lesson_minutes: 40,
  break_minutes: 10,
  day_breaks: [],
}

export type TimetableProjectStatus = 'taslak' | 'yayinda' | 'arsiv'

export interface TimetableProject {
  id: number
  tenant_id: number
  school_id: number
  name: string
  academic_year: string | null
  days: number[]
  periods_per_day: number
  lunch_after: number | null
  settings: TimetableSettings
  status: TimetableProjectStatus
  published_at: string | null
  School?: { id: number; name: string } | null
  counts?: { assignments: number; constraints: number; lessons: number }
  created_at: string
  updated_at: string
}

export interface TimetableProjectPayload {
  school_id?: number
  name?: string
  academic_year?: string | null
  days?: number[]
  periods_per_day?: number
  lunch_after?: number | null
  settings?: Partial<TimetableSettings>
}

export interface TimetableRoom {
  id: number
  school_id: number
  name: string
  room_type: string | null
  capacity: number
  is_active: boolean
}

export interface TimetableAssignment {
  id: number
  project_id: number
  classroom_id: number
  subject_id: number
  teacher_id: number | null
  weekly_hours: number
  block_pattern: string | null
  room_id: number | null
  sync_group: string | null
  Classroom?: { id: number; class_level: string; section: string } | null
  Subject?: { id: number; name: string; code: string | null; difficulty_level: string | null } | null
  Teacher?: { id: number; first_name: string; last_name: string; brans: string | null } | null
  Room?: { id: number; name: string } | null
}

export interface TimetableAssignmentPayload {
  classroom_id?: number
  subject_id?: number
  teacher_id?: number | null
  weekly_hours?: number
  block_pattern?: string | null
  room_id?: number | null
  sync_group?: string | null
}

export type ConstraintType =
  | 'teacher_unavailable'
  | 'classroom_unavailable'
  | 'room_unavailable'
  | 'teacher_max_daily_hours'
  | 'teacher_min_days_off'
  | 'teacher_max_consecutive'
  | 'subject_period_preference'
  | 'subject_max_daily'

export interface ConstraintSlot {
  day: number
  periods: number[]
}

export interface ConstraintParams {
  teacher_id?: number | null
  classroom_id?: number | null
  room_id?: number | null
  subject_id?: number | null
  slots?: ConstraintSlot[]
  max?: number
  count?: number
  mode?: 'only' | 'avoid'
  periods?: number[]
  days?: number[]
}

export interface TimetableConstraint {
  id: number
  type: ConstraintType
  type_label: string
  is_hard: boolean
  weight: number | null
  params: ConstraintParams
  source: 'manuel' | 'ai'
  source_text: string | null
  is_active: boolean
  summary: string
}

export interface ConstraintInput {
  type: ConstraintType
  is_hard: boolean
  weight?: number | null
  params: ConstraintParams
  source?: 'manuel' | 'ai'
  source_text?: string | null
}

export interface AiProposal {
  type: ConstraintType
  is_hard: boolean
  weight: number | null
  params: ConstraintParams
  explanation: string
  summary: string
}

export interface CheckIssue {
  level: 'error' | 'warning'
  message: string
}

export interface CheckResult {
  ok: boolean
  issues: CheckIssue[]
  stats: { assignments: number; classrooms: number; teachers: number; total_hours: number; slots_per_week: number }
}

export type RunStatus = 'kuyrukta' | 'calisiyor' | 'tamamlandi' | 'basarisiz' | 'iptal'

export interface TimetableRun {
  id: number
  project_id: number
  status: RunStatus
  time_limit: number
  solver_status: string | null
  objective: number | null
  best_bound: number | null
  progress: { solutions: number; objective: number; best_bound: number; elapsed: number } | null
  result: {
    lesson_count: number
    score: Record<string, number>
    violations: Array<{ constraint_id: number; count: number }>
  } | null
  diagnostics: Array<{ level: 'error' | 'warning'; message: string; constraint_ids?: number[] }> | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  applied_at: string | null
  created_at: string
}

export interface TimetableLesson {
  id: number
  assignment_id: number
  day_of_week: number
  period_no: number
  room_id: number | null
  is_locked: boolean
  Assignment: TimetableAssignment
}

export interface TimetableMeta {
  ai_configured: boolean
  ai_licensed: boolean
  ai_usage: { used: number; limit: number } | null
  ai_enabled: boolean
  ai_model: string | null
  solver_available: boolean
  constraint_types: Array<{ key: ConstraintType; label: string; fields: string[] }>
  default_settings: TimetableSettings
}

export const SCORE_LABELS: Record<string, string> = {
  teacher_gaps: 'Öğretmen boş saatleri',
  class_compact: 'Şube boşlukları / geç başlama',
  teacher_single_hour_day: 'Öğretmenin tek saatlik günleri',
  hard_subject_late: 'Zor derslerin son saatlere düşmesi',
  soft_constraints: 'Esnek kısıt ihlalleri',
}

export const WEIGHT_LABELS: Record<keyof TimetableWeights, string> = {
  teacher_gaps: 'Öğretmen boş saati (pencere)',
  class_compact: 'Şube gününde boşluk / geç başlama',
  teacher_single_hour_day: 'Öğretmenin okula tek ders için gelmesi',
  hard_subject_late: 'Zor dersin son saatlere düşmesi',
  soft_constraint: 'Esnek kısıt varsayılan ağırlığı',
}

export const RUN_STATUS_LABELS: Record<RunStatus, { label: string; color: string }> = {
  kuyrukta: { label: 'Kuyrukta', color: 'default' },
  calisiyor: { label: 'Çalışıyor', color: 'processing' },
  tamamlandi: { label: 'Tamamlandı', color: 'success' },
  basarisiz: { label: 'Başarısız', color: 'error' },
  iptal: { label: 'İptal', color: 'warning' },
}

export const ROOM_TYPES = [
  { value: 'laboratuvar', label: 'Laboratuvar' },
  { value: 'spor_salonu', label: 'Spor salonu' },
  { value: 'bt_sinifi', label: 'BT sınıfı' },
  { value: 'atolye', label: 'Atölye' },
  { value: 'muzik', label: 'Müzik sınıfı' },
  { value: 'resim', label: 'Resim atölyesi' },
  { value: 'diger', label: 'Diğer' },
]
