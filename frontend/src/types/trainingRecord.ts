export interface TrainingTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
}

export interface TrainingRecord {
  id: number
  tenant_id: number
  teacher_id: number
  title: string
  institution: string | null
  start_date: string | null
  end_date: string | null
  hours: number | null
  certificate_no: string | null
  notes: string | null
  Teacher?: TrainingTeacher | null
  created_at: string
  updated_at: string
}

export interface TrainingRecordPayload {
  teacher_id: number
  title: string
  institution?: string | null
  start_date?: string | null
  end_date?: string | null
  hours?: number | null
  certificate_no?: string | null
  notes?: string | null
}
