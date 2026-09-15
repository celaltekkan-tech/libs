export interface PersonnelCategory {
  id: number
  tenant_id: number
  name: string
  code: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PersonnelCategoryPayload {
  name: string
  sort_order?: number
}
