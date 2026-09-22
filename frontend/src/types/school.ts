export type SchoolType = 'ilkokul' | 'ortaokul' | 'lise'

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
}

export const FOREIGN_LANGUAGE_OPTIONS = [
  'İngilizce',
  'Almanca',
  'Rusça',
  'Çince',
  'Fransızca',
  'İspanyolca',
  'Portekizce',
  'Arapça',
  'Farsça',
] as const

export interface SchoolMeta {
  first_foreign_language?: string | null
  second_foreign_language?: string | null
}

export interface School {
  id: number
  tenant_id: number
  name: string
  code: string
  school_type: SchoolType
  daily_period_count: number
  province_id?: number | null
  district_id?: number | null
  directory_school_id?: number | null
  logo_url?: string | null
  meta?: SchoolMeta | null
  Province?: { id: number; name: string } | null
  District?: { id: number; name: string } | null
  created_at: string
  updated_at: string
}

export const SCHOOL_CODE_PATTERN = /^\d{6}$/
export const SCHOOL_CODE_MESSAGE = 'Okul kodu 6 haneli sayı olmalıdır'
export const SCHOOL_CODE_RULES = [
  { required: true, message: 'Okul kodu zorunludur' },
  { pattern: SCHOOL_CODE_PATTERN, message: SCHOOL_CODE_MESSAGE },
]

export interface SchoolPayload {
  name: string
  code?: string
  school_type: SchoolType
  daily_period_count?: number
  province_id?: number | null
  district_id?: number | null
  directory_school_id?: number | null
  meta?: SchoolMeta | null
}
