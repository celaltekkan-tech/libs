export interface Teacher {
  id: number
  tenant_id: number
  school_id: number | null
  city: string | null
  district: string | null
  personnel_no: string | null
  national_id: string | null
  phone: string | null
  email: string | null
  first_name: string
  last_name: string
  last_graduated_school: string | null
  class_level: string | null
  title_branch: string | null
  unvan: string | null
  brans: string | null
  kariyer: string | null
  working_institution: string | null
  degree: string | null
  pension_degree: string | null
  rank: string | null
  degree_rank_date: string | null
  degree_rank_anchor_date: string | null
  eight_year_base_date: string | null
  school_principal: string | null
  annual_leave_quota: number | null
  service_start_date: string | null
  first_duty_date: string | null
  personnel_type: string
  contract_start_date: string | null
  contract_end_date: string | null
  union_name: string | null
  personnel_category_id: number | null
  PersonnelCategory?: { id: number; name: string; code: string | null } | null
  created_at: string
  updated_at: string
}

export type PromotionType = 'yillik' | 'sekiz_yil' | 'kariyer' | 'manuel'

export interface PromotionHistory {
  id: number
  tenant_id: number
  teacher_id: number
  previous_degree: string | null
  previous_rank: string | null
  previous_degree_rank_date: string | null
  new_degree: string
  new_rank: string
  new_degree_rank_date: string
  note: string | null
  type: PromotionType
  override_reason: string | null
  is_permanent: boolean
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface ApplyPromotionPayload {
  new_degree: string
  new_rank: string
  new_degree_rank_date: string
  note?: string | null
  type?: PromotionType
  override_reason?: string | null
  is_permanent?: boolean
}

export interface ReportEightYearCheckPayload {
  has_penalty: boolean
  penalty_date?: string | null
  note?: string | null
}

export interface TeacherPayload {
  school_id?: number | null
  city?: string | null
  district?: string | null
  personnel_no?: string | null
  national_id?: string | null
  phone?: string | null
  email?: string | null
  first_name: string
  last_name: string
  last_graduated_school?: string | null
  class_level?: string | null
  title_branch?: string | null
  unvan?: string | null
  brans?: string | null
  kariyer?: string | null
  working_institution?: string | null
  degree?: string | null
  pension_degree?: string | null
  rank?: string | null
  degree_rank_date?: string | null
  school_principal?: string | null
  annual_leave_quota?: number | null
  service_start_date?: string | null
  first_duty_date?: string | null
  personnel_type?: string
  personnel_category_id?: number | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  union_name?: string | null
}
