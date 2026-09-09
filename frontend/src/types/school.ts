export interface School {
  id: number
  tenant_id: number
  name: string
  code: string
  created_at: string
  updated_at: string
}

export interface SchoolPayload {
  name: string
  code: string
}
