export interface DisciplineClassroom {
  id: number
  class_level: string
  section: string
}

export interface DisciplineStudent {
  id: number
  first_name: string
  last_name: string
  student_number: string | null
  national_id?: string | null
  birth_date?: string | null
  boarding_status?: string | null
  class_level?: string | null
  section?: string | null
  parent_name?: string | null
  mother_name?: string | null
  father_name?: string | null
  parent_phone?: string | null
  Classroom?: DisciplineClassroom | null
}

// ---- Roller / durumlar ----
export const PARTICIPANT_ROLE_OPTIONS = [
  { value: 'magdur', label: 'Mağdur Öğrenci' },
  { value: 'suclanan', label: 'Suçlanan Öğrenci' },
  { value: 'tanik', label: 'Görgü Tanığı' },
]
export const PARTICIPANT_ROLE_LABELS: Record<string, string> = Object.fromEntries(
  PARTICIPANT_ROLE_OPTIONS.map((o) => [o.value, o.label]),
)

export const PARTICIPANT_STATUS_OPTIONS = [
  { value: 'kayitli', label: 'Kayıtlı' },
  { value: 'ifade_bekleniyor', label: 'İfade Bekleniyor' },
  { value: 'savunma_bekleniyor', label: 'Savunma Bekleniyor' },
  { value: 'karara_baglandi', label: 'Karara Bağlandı' },
  { value: 'kapandi', label: 'Kapandı' },
]
export const PARTICIPANT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PARTICIPANT_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export const INCIDENT_STATUS_OPTIONS = [
  { value: 'acik', label: 'Açık' },
  { value: 'inceleniyor', label: 'İnceleniyor' },
  { value: 'karara_baglandi', label: 'Karara Bağlandı' },
  { value: 'kapandi', label: 'Kapandı' },
]
export const INCIDENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  INCIDENT_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export const SANCTION_TYPE_OPTIONS = [
  { value: 'uyari', label: 'Uyarı' },
  { value: 'kinama', label: 'Kınama' },
  { value: 'okuldan_kisa_sureli_uzaklastirma', label: 'Okuldan Kısa Süreli Uzaklaştırma' },
  { value: 'okuldan_uzun_sureli_uzaklastirma', label: 'Okuldan Uzun Süreli Uzaklaştırma' },
  { value: 'okul_degistirme', label: 'Okul Değiştirme' },
]
export const SANCTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SANCTION_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const DECISION_STATUS_OPTIONS = [
  { value: 'taslak', label: 'Taslak' },
  { value: 'onaylandi', label: 'Onaylandı' },
  { value: 'itiraz_edildi', label: 'İtiraz Edildi' },
  { value: 'iptal', label: 'İptal' },
]
export const DECISION_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DECISION_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export const STATEMENT_TYPE_OPTIONS = [
  { value: 'yazili_ifade', label: 'Yazılı İfade' },
  { value: 'sozlu_ifade', label: 'Sözlü İfade ve Savunma' },
  { value: 'savunma', label: 'Disiplin Savunma Tutanağı' },
]
export const STATEMENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  STATEMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const INFO_SOURCE_TYPE_OPTIONS = [
  { value: 'ogretmen', label: 'Öğretmen' },
  { value: 'rehberlik', label: 'Rehber Öğretmen' },
  { value: 'arkadas', label: 'Öğrenci (Arkadaşı)' },
  { value: 'genel', label: 'Genel' },
]
export const INFO_SOURCE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  INFO_SOURCE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const NOTICE_TYPE_OPTIONS = [
  { value: 'ogrenciye_cagri', label: 'Öğrenciye Çağrı Pusulası' },
  { value: 'kurul_toplantisi', label: 'Kurul Toplantı Çağrısı' },
]
export const NOTICE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  NOTICE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const NOTIFICATION_TYPE_OPTIONS = [
  { value: 'ogrenciye_ceza_bildirimi', label: 'Öğrenciye Ceza Bildirimi' },
  { value: 'veliye_bildirim', label: 'Veliye Bildirim' },
  { value: 'ceza_gunu_bildirimi', label: 'Ceza Günü Bildirimi' },
]
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  NOTIFICATION_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

// ---- Varlıklar ----
export interface DisciplineParticipant {
  id: number
  incident_id: number
  student_id: number
  role: string
  status: string
  health_status: string | null
  economic_status_mother: string | null
  economic_status_father: string | null
  family_together: string | null
  parents_alive: string | null
  parents_biological: string | null
  raised_environment: string | null
  family_address: string | null
  notes: string | null
  Student?: DisciplineStudent | null
  created_at: string
  updated_at: string
}

export interface DisciplineIncident {
  id: number
  tenant_id: number
  school_id: number
  incident_code: string
  academic_year: string
  title: string
  incident_date: string
  incident_time: string | null
  location: string | null
  summary: string | null
  complainant_name: string | null
  complaint_ref_date: string | null
  complaint_ref_no: string | null
  status: string
  created_by: number | null
  Participants?: DisciplineParticipant[]
  School?: { id: number; name: string } | null
  CreatedBy?: { id: number; full_name: string } | null
  created_at: string
  updated_at: string
}

export interface DisciplineIncidentPayload {
  school_id: number
  title: string
  incident_date: string
  incident_time?: string | null
  location?: string | null
  summary?: string | null
  complainant_name?: string | null
  complaint_ref_date?: string | null
  complaint_ref_no?: string | null
}

export interface DisciplineStatementQuestion {
  question: string
  answer: string
}

export interface DisciplineStatement {
  id: number
  incident_id: number
  participant_id: number
  statement_type: string
  content: string | null
  taken_by: string | null
  written_by: string | null
  taken_at: string | null
  location: string | null
  questions: DisciplineStatementQuestion[] | null
  student_home_phone: string | null
  student_mobile_phone: string | null
  student_home_address: string | null
  guardian_work_phone: string | null
  guardian_mobile_phone: string | null
  guardian_work_address: string | null
  Participant?: DisciplineParticipant | null
  created_at: string
}

export interface DisciplineInfoRequest {
  id: number
  incident_id: number
  participant_id: number
  source_type: string
  source_name: string | null
  source_branch: string | null
  content: Record<string, string>
  response_date: string | null
  Participant?: DisciplineParticipant | null
  created_at: string
}

export interface DisciplineBoardMember {
  name: string
  title: string
}

export interface DisciplineMeetingNotice {
  id: number
  incident_id: number
  participant_id: number | null
  notice_type: string
  meeting_date: string | null
  meeting_time: string | null
  location: string | null
  agenda: string | null
  board_members: DisciplineBoardMember[]
  acknowledged: boolean
  acknowledged_date: string | null
  Participant?: DisciplineParticipant | null
  created_at: string
}

export interface DisciplineRegulationArticle {
  id: number
  tenant_id: number | null
  article_no: string | null
  title: string | null
  description: string | null
  default_sanction_type: string | null
  source: 'meb' | 'custom'
}

export interface DisciplineDecision {
  id: number
  incident_id: number
  participant_id: number
  decision_no: string | null
  decision_date: string | null
  prior_sanctions_summary: string | null
  behavior_date: string | null
  behavior_place: string | null
  behavior_type: string | null
  behavior_reason: string | null
  statements_summary: string | null
  mitigating_aggravating_factors: string | null
  board_opinion: string | null
  regulation_article_id: number | null
  regulation_article_text: string | null
  sanction_type: string | null
  sanction_days: number | null
  board_members: DisciplineBoardMember[]
  board_decision: string | null
  approved_by: string | null
  approved_date: string | null
  status: string
  Participant?: DisciplineParticipant | null
  RegulationArticle?: DisciplineRegulationArticle | null
  created_at: string
}

export interface DisciplineNotification {
  id: number
  decision_id: number
  participant_id: number
  notification_type: string
  sent_date: string | null
  sanction_start_date: string | null
  sanction_end_date: string | null
  broken_behavior_point: number | null
  remaining_behavior_point: number | null
  acknowledged_by: string | null
  acknowledged_date: string | null
  Participant?: DisciplineParticipant | null
  created_at: string
}

export interface DisciplineBehaviorPoint {
  id: number
  tenant_id: number
  student_id: number
  participant_id: number | null
  decision_id: number | null
  academic_year: string
  points_deducted: number
  points_restored: number
  restore_date: string | null
  reason: string | null
  Student?: DisciplineStudent | null
  created_at: string
}

export interface DisciplineStats {
  total_incidents: number
  total_decisions: number
  by_status: Record<string, number>
  by_month: Record<string, number>
  by_sanction: Record<string, number>
}

export interface DisciplineSanctionedStudent {
  student: DisciplineStudent
  decisions: Array<{
    id: number
    sanction_type: string | null
    decision_date: string | null
    status: string
    incident: { id: number; incident_code: string; title: string; incident_date: string }
  }>
}

export interface DisciplineBehaviorPointSummary {
  student: DisciplineStudent
  points_deducted: number
  points_restored: number
  entries: DisciplineBehaviorPoint[]
}

export interface DisciplineExcelPreviewRow {
  row_index: number
  input_number: string
  input_national_id: string
  student_id: number | null
  full_name: string
  classroom: string
  already_added: boolean
  role: string
  matched: boolean
}
