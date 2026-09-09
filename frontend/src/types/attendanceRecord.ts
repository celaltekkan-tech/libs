export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'geldi', label: 'Geldi' },
  { value: 'gelmedi', label: 'Gelmedi' },
  { value: 'izinli', label: 'İzinli' },
  { value: 'raporlu', label: 'Raporlu' },
  { value: 'fazla_mesai', label: 'Fazla Mesai' },
]

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ATTENDANCE_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export interface AttendanceTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
  personnel_type: string
}

export interface AttendanceRecord {
  id: number
  tenant_id: number
  teacher_id: number
  attendance_date: string
  status: string
  overtime_hours: string | number | null
  notes: string | null
  Teacher?: AttendanceTeacher | null
  created_at: string
  updated_at: string
}

export interface AttendanceEntry {
  teacher_id: number
  status: string
  overtime_hours?: number | null
  notes?: string | null
}

export interface AttendanceMonthlySummaryRow {
  teacher_id: number
  teacher_name: string
  personnel_no: string | null
  counts: Record<string, number>
  overtime_total: number
}
