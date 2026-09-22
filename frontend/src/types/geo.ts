export interface Province {
  id: number
  name: string
  slug?: string | null
  region?: string | null
}

export interface District {
  id: number
  province_id: number
  name: string
  slug?: string | null
}

export type DirectorySchoolType = 'ortaokul' | 'lise'

export const DIRECTORY_SCHOOL_TYPE_LABELS: Record<DirectorySchoolType, string> = {
  ortaokul: 'Ortaokul',
  lise: 'Lise',
}

export interface DirectorySchool {
  id: number
  name: string
  school_type: DirectorySchoolType
  website: string | null
  code: string | null
  province_id: number
  district_id: number | null
  Province?: Pick<Province, 'id' | 'name'> | null
  District?: Pick<District, 'id' | 'name'> | null
  logo_url?: string | null
}

export interface DirectorySchoolListMeta {
  total: number
  limit: number
  offset: number
}
