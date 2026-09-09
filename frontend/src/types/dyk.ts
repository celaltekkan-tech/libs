export interface DykCourse {
  id: number
  tenant_id: number
  school_id: number | null
  subject_id: number | null
  teacher_id: number | null
  name: string
  academic_year: string | null
  min_attendance_rate: number
  is_active: boolean
  Subject?: { id: number; name: string } | null
  Teacher?: { id: number; first_name: string; last_name: string } | null
  created_at: string
  updated_at: string
}

export interface DykCoursePayload {
  school_id?: number | null
  subject_id?: number | null
  teacher_id?: number | null
  name: string
  academic_year?: string | null
  min_attendance_rate?: number
  is_active?: boolean
}

export interface DykEnrollment {
  id: number
  dyk_course_id: number
  student_id: number
  Student?: { id: number; first_name: string; last_name: string; student_number: string | null } | null
}

export interface DykAttendanceSummaryRow {
  student_id: number
  student_name: string | null
  student_number: string | null
  total_sessions: number
  attended_sessions: number
  attendance_rate: number | null
  below_threshold: boolean
}
