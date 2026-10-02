export interface TimetableWeights {
  teacher_gaps: number
  class_compact: number
  teacher_single_hour_day: number
  hard_subject_late: number
  soft_constraint: number
  availability_avoid: number
  block_flex: number
  teacher_day_off?: number
}

export type SameClassSubjectsMode = 'off' | 'soft' | 'hard'

/** Çalışma geneli dağıtım ayarları. 0 = sınır yok. */
export interface DistributionSettings {
  place_seconds: number
  gap_seconds: number
  split_double: boolean
  merge_singles: boolean
  merge_two_one: boolean
  eliminate_gaps: boolean
  free_day: boolean
  same_class_subjects: SameClassSubjectsMode
  prioritize_difficulty: boolean
  max_daily_hours: number
  max_windows: number
  workers: number
  methods: 'all' | 'single'
  /** cpsat: kısıt çözücü, greedy: sıkışık ders önce, local: yerel iyileştirme */
  algorithms?: Array<'cpsat' | 'greedy' | 'local'>
}

export interface AlgorithmComparison {
  algorithm: string
  label: string
  ok: boolean
  penalty: number | null
  gaps: number | null
  seconds: number
  delta: number | null
  winner: boolean
  note: string | null
}

/** Öğretmene özel dağıtım. Boş alan genel ayarı kullanır. 0 = sınır yok. */
export interface TeacherDistributionOverride {
  max_daily_hours?: number | null
  max_windows?: number | null
  free_day?: boolean | null
  same_class_subjects?: 'inherit' | 'off' | 'on' | null
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
  /** 1. teneffüs, 2. teneffüs... Dersler arasındaki ara. Boşsa break_minutes kullanılır. */
  breaks?: number[]
  day_breaks: DayBreak[]
}

export interface TimetableSettings {
  time_limit: number
  max_subject_daily: number
  max_culture_daily?: number
  max_vocational_daily?: number
  weights: TimetableWeights
  bell?: BellSchedule
  block_across_lunch?: boolean
  class_lunch?: Record<string, number>
  distribution?: DistributionSettings
  teacher_overrides?: Record<string, TeacherDistributionOverride>
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
  counts?: { assignments: number; constraints: number; lessons: number; availability?: number }
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
  copy_from?: { project_id: number; parts: Array<'assignments' | 'availability' | 'constraints'> }
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
  co_teacher_ids: number[]
  elective_group: string | null
  // 'pool': ders havuzundaki ortak dersten otomatik eklendi
  source?: string | null
  allow_split: boolean | null
  allow_merge: boolean | null
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
  co_teacher_ids?: number[]
  elective_group?: string | null
  allow_split?: boolean | null
  allow_merge?: boolean | null
}

export type ConstraintType =
  | 'teacher_unavailable'
  | 'classroom_unavailable'
  | 'room_unavailable'
  | 'teacher_max_daily_hours'
  | 'teacher_duty_day_max_hours'
  | 'teacher_no_duty'
  | 'teacher_min_days_off'
  | 'teacher_max_consecutive'
  | 'subject_period_preference'
  | 'subject_max_daily'
  | 'subjects_not_same_day'
  | 'subjects_same_day'
  | 'subject_no_lunch_split'

export interface ConstraintSlot {
  day: number
  periods: number[]
}

export interface ConstraintParams {
  teacher_id?: number | null
  teacher_ids?: number[]
  classroom_id?: number | null
  room_id?: number | null
  subject_id?: number | null
  subject_ids?: number[]
  scope?: 'class' | 'school'
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
  progress: {
    solutions?: number
    objective?: number
    best_bound?: number
    elapsed?: number
    phase?: 'ai'
    message?: string
    strategy?: string
    strategy_label?: string
  } | null
  result: {
    lesson_count: number
    score: Record<string, number>
    violations: Array<{ constraint_id: number; count: number }>
    strategy?: string | null
    strategy_label?: string | null
    comparisons?: AlgorithmComparison[]
    comparison_note?: string | null
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
  availability_avoid: 'İstenmeyen saatlere düşen dersler',
  block_flex: 'Bölünen / birleştirilen bloklar',
  teacher_day_off: 'Öğretmene boş gün verilememesi',
}

export const WEIGHT_LABELS: Record<keyof TimetableWeights, string> = {
  teacher_gaps: 'Öğretmen boş saati (pencere)',
  class_compact: 'Şube gününde boşluk / geç başlama',
  teacher_single_hour_day: 'Öğretmenin okula tek ders için gelmemesi',
  hard_subject_late: 'Zor dersin son saatlere düşmemesi',
  soft_constraint: 'Esnek kısıt varsayılan ağırlığı',
  availability_avoid: 'Zaman tablosunda "istenmiyor" saate ders',
  block_flex: 'Blok esnekliği',
  teacher_day_off: 'Öğretmene boş gün verilememesi',
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

// ---- branş, ders havuzu, zaman tablosu

export interface Branch {
  id: number
  tenant_id: number
  code: string | null
  name: string
}

export interface PoolSubject {
  id: number
  name: string
  code: string | null
  difficulty_level: string | null
  branch_id: number | null
  allow_split: boolean
  allow_merge: boolean
  is_elective: boolean
  course_kind?: 'kultur' | 'meslek'
  elective_group: string | null
  is_guidance: boolean
  is_activity: boolean
  is_active: boolean
}

export interface PoolHour {
  id: number
  subject_id: number
  class_level: string
  weekly_hours: number
  block_pattern: string | null
}

export interface LessonPool {
  subjects: PoolSubject[]
  hours: PoolHour[]
  branches: Branch[]
}

export type AvailabilityEntity = 'school' | 'teacher' | 'classroom' | 'room' | 'subject'
export type CellState = 'closed' | 'avoid'
// "gün-saat" -> durum; listede olmayan hücre açıktır
export type AvailabilityCells = Record<string, CellState>

export interface TimetableAvailability {
  id: number
  project_id: number
  entity_type: AvailabilityEntity
  entity_id: number
  cells: AvailabilityCells
}

export interface ElectiveStudent {
  id: number
  student_number: string | null
  first_name: string
  last_name: string
}

export interface ElectiveData {
  students: ElectiveStudent[]
  choices: Array<{ assignment_id: number; student_id: number }>
}

export interface CommonSyncResult {
  created: number
  classrooms: number
  // bir seviyede birden fazla saati olan ortak dersler (kullanıcı seçmeli)
  needs_choice: Array<{ classroom_id: number; subject_id: number; subject_name: string; options: number[] }>
  // şube id -> kaldırılmış ortak ders id'leri
  excluded: Record<string, number[]>
}
