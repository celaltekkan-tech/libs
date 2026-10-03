export type MobileRegisterRequestStatus = 'pending' | 'approved' | 'rejected'

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
  status: MobileRegisterRequestStatus
  teacher_id: number | null
  user_id: number | null
  reject_reason: string | null
  reviewed_at: string | null
  reviewed_by_name: string | null
  created_at: string
  updated_at: string
}
