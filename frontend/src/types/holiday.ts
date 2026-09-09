export interface Holiday {
  id: number
  tenant_id: number
  name: string
  month: number
  day: number
  year: number | null
  created_at: string
  updated_at: string
}

export interface HolidayPayload {
  name: string
  month: number
  day: number
  year?: number | null
}
