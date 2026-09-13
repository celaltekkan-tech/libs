/** TYP EK-2 hücre kodları — Excel çıktısında kullanılır; kodlar sonra güncellenebilir. */
export const TYP_STATUS_CODES: Record<string, string> = {
  geldi: '',
  fazla_mesai: '',
  gelmedi: 'D',
  izinli: 'Ü',
  raporlu: 'R',
  mazeretli: 'M',
  is_kazasi: 'İ',
}

/** Devamsızlık / mazeret durumları (neden alanı bunlarda anlamlı) */
export const ABSENCE_STATUSES = new Set(['gelmedi', 'izinli', 'raporlu', 'mazeretli', 'is_kazasi'])

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'geldi', label: 'Geldi' },
  { value: 'gelmedi', label: 'Gelmedi (D)' },
  { value: 'izinli', label: 'Ücretsiz İzin (Ü)' },
  { value: 'raporlu', label: 'Raporlu (R)' },
  { value: 'mazeretli', label: 'Mazeretli (M)' },
  { value: 'is_kazasi', label: 'İş Kazası (İ)' },
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
