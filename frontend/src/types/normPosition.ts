export interface NormPositionSchool {
  id: number
  name: string
  code: string
}

export interface NormPosition {
  id: number
  tenant_id: number
  school_id: number | null
  title_branch: string
  quota_count: number
  notes: string | null
  filled_count: number
  vacant_count: number
  occupancy_rate: number | null
  School?: NormPositionSchool | null
  created_at: string
  updated_at: string
}

export interface NormPositionPayload {
  school_id?: number | null
  title_branch: string
  quota_count: number
  notes?: string | null
}
