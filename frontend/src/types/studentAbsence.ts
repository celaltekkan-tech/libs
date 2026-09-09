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
  is_excused: boolean
  reason: string | null
  Student?: AbsenceStudent | null
  created_at: string
  updated_at: string
}

export interface AbsenceWarningRow {
  student_id: number
  student_name: string
  student_number: string | null
  classroom: string | null
  count: number
  threshold_crossed: number | null
}
