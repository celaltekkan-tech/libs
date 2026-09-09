export interface DutyLocation {
  id: number
  tenant_id: number
  school_id: number | null
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DutyLocationPayload {
  school_id?: number | null
  name: string
  is_active?: boolean
}

export interface DutyTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
}

export interface DutyAssignment {
  id: number
  tenant_id: number
  school_id: number | null
  teacher_id: number
  duty_location_id: number
  duty_date: string
  notes: string | null
  incident_note: string | null
  Teacher?: DutyTeacher | null
  DutyLocation?: { id: number; name: string } | null
  created_at: string
  updated_at: string
}

export interface DutyAssignmentPayload {
  school_id?: number | null
  teacher_id: number
  duty_location_id: number
  duty_date: string
  notes?: string | null
}

export interface DutyFairnessRow {
  teacher_id?: number
  teacher_name?: string
  duty_location_id?: number
  name?: string
  count: number
}

export interface DutyFairnessReport {
  by_teacher: DutyFairnessRow[]
  by_location: DutyFairnessRow[]
}
