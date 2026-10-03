export type MobileRegisterRequestStatus = 'pending' | 'approved' | 'rejected'

export interface MobileRegisterMismatch {
  field: 'national_id' | 'phone'
  kind: 'empty' | 'mismatch'
  ours: string | null
  requested: string | null
}

export interface MobileRegisterTeacherSnapshot {
  id: number
  first_name: string | null
  last_name: string | null
  national_id: string | null
  phone: string | null
  email: string | null
}

export interface LinkableTeacher {
  id: number
  first_name: string
  last_name: string
  full_name: string
  national_id: string | null
  phone: string | null
  email: string | null
  school_id: number | null
}

export interface MobileRegisterRequest {
  id: number
  tenant_id: number
  school_id: number
  school_name: string | null
  national_id: string
  first_name: string
  last_name: string
  full_name: string
  phone: string
  email: string | null
  status: MobileRegisterRequestStatus
  teacher_id: number | null
  user_id: number | null
  reject_reason: string | null
  reviewed_at: string | null
  reviewed_by_user_id: number | null
  reviewed_by_name: string | null
  reviewed_by_email: string | null
  teacher_on_file?: MobileRegisterTeacherSnapshot | null
  matched_fields?: Array<'name' | 'national_id' | 'phone' | 'email'>
  not_registered?: boolean
  mismatches?: MobileRegisterMismatch[]
  warning_message?: string | null
  created_at: string
  updated_at: string
}
