export type SchoolType = 'ilkokul' | 'ortaokul' | 'lise'

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
}

export interface School {
  id: number
  tenant_id: number
  name: string
  code: string
  school_type: SchoolType
  created_at: string
  updated_at: string
}

export interface SchoolPayload {
  name: string
  code: string
  school_type: SchoolType
}
