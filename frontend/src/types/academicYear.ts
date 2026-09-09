export interface AcademicYear {
  id: number
  tenant_id: number
  label: string
  start_date: string | null
  end_date: string | null
  is_current: boolean
  created_at: string
  updated_at: string
}

export interface AcademicYearPayload {
  label: string
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean
}
