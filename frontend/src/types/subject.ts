export interface Subject {
  id: number
  tenant_id: number
  name: string
  code: string | null
  difficulty_level: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SubjectPayload {
  name: string
  code?: string | null
  difficulty_level?: string | null
  is_active?: boolean
}

export const DIFFICULTY_LEVEL_OPTIONS = [
  { value: 'kolay', label: 'Kolay' },
  { value: 'orta', label: 'Orta' },
  { value: 'zor', label: 'Zor' },
]

export interface SubjectClassHour {
  id: number
  tenant_id: number
  subject_id: number
  class_level: string
  weekly_hours: number
  created_at: string
  updated_at: string
}

export interface SubjectClassHourPayload {
  subject_id: number
  class_level: string
  weekly_hours: number
}
