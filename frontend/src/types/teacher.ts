export interface Teacher {
  id: number
  tenant_id: number
  school_id: number | null
  city: string | null
  district: string | null
  personnel_no: string | null
  national_id: string | null
  first_name: string
  last_name: string
  last_graduated_school: string | null
  class_level: string | null
  title_branch: string | null
  working_institution: string | null
  degree: string | null
  pension_degree: string | null
  rank: string | null
  degree_rank_date: string | null
  school_principal: string | null
  annual_leave_quota: number | null
  service_start_date: string | null
  personnel_type: string
  contract_start_date: string | null
  contract_end_date: string | null
  created_at: string
  updated_at: string
}

export interface TeacherPayload {
  school_id?: number | null
  city?: string | null
  district?: string | null
  personnel_no?: string | null
  national_id?: string | null
  first_name: string
  last_name: string
  last_graduated_school?: string | null
  class_level?: string | null
  title_branch?: string | null
  working_institution?: string | null
  degree?: string | null
  pension_degree?: string | null
  rank?: string | null
  degree_rank_date?: string | null
  school_principal?: string | null
  annual_leave_quota?: number | null
  service_start_date?: string | null
  personnel_type?: string
  contract_start_date?: string | null
  contract_end_date?: string | null
}
