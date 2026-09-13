export const FLOOR_LEVEL_OPTIONS = [
  { value: 0, label: 'Zemin Kat' },
  { value: 1, label: '1. Kat' },
  { value: 2, label: '2. Kat' },
  { value: 3, label: '3. Kat' },
  { value: 4, label: '4. Kat' },
  { value: 5, label: '5. Kat' },
]

export function floorLevelLabel(level: number | null | undefined): string {
  if (level == null) return '—'
  const found = FLOOR_LEVEL_OPTIONS.find((o) => o.value === level)
  return found ? found.label : `${level}. Kat`
}

export interface DutyLocation {
  id: number
  tenant_id: number
  school_id: number | null
  name: string
  /** @deprecated UI'da kullanılmıyor; API uyumu için tutuluyor */
  floor_level?: number
  /** @deprecated UI'da kullanılmıyor; API uyumu için tutuluyor */
  sort_order?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DutyLocationPayload {
  school_id?: number | null
  name: string
  floor_level?: number
  sort_order?: number
  is_active?: boolean
}

export interface DutyTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
}

export interface DutyAssignment {
  id: number
  tenant_id: number
  school_id: number | null
  teacher_id: number
  duty_location_id: number
  duty_date: string
  notes: string | null
  incident_note: string | null
  Teacher?: DutyTeacher | null
  DutyLocation?: { id: number; name: string; floor_level?: number; sort_order?: number } | null
  created_at: string
  updated_at: string
}

export interface DutyAssignmentPayload {
  school_id?: number | null
  teacher_id: number
  duty_location_id: number
  duty_date: string
  notes?: string | null
}

export interface DutyFairnessRow {
  teacher_id?: number
  teacher_name?: string
  duty_location_id?: number
  name?: string
  count: number
}

export interface DutyFairnessReport {
  by_teacher: DutyFairnessRow[]
  by_location: DutyFairnessRow[]
}

export type DutyGenerateMode = 'fair' | 'weekly_rotate'
