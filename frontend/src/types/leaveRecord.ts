export const LEAVE_TYPE_OPTIONS = [
  { value: 'yillik', label: 'Yıllık İzin' },
  { value: 'mazeret', label: 'Mazeret İzni' },
  { value: 'rapor', label: 'Rapor' },
  { value: 'ucretsiz', label: 'Ücretsiz İzin' },
]

export const LEAVE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  LEAVE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export interface LeaveTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
  annual_leave_quota: number | null
}

export interface LeaveRecord {
  id: number
  tenant_id: number
  teacher_id: number
  leave_type: string
  start_date: string
  end_date: string
  day_count: number
  reason: string | null
  Teacher?: LeaveTeacher | null
  created_at: string
  updated_at: string
}

export interface LeaveRecordPayload {
  teacher_id: number
  leave_type: string
  start_date: string
  end_date: string
  reason?: string | null
}

export type LeaveQuotaSource = 'override' | 'auto' | 'default'

export const LEAVE_QUOTA_SOURCE_LABELS: Record<LeaveQuotaSource, string> = {
  override: 'Manuel olarak belirlendi',
  auto: '657 sayılı DMK m.102\'ye göre kıdeme dayalı otomatik hesaplandı',
  default: 'İşe başlama tarihi tanımlı değil, varsayılan uygulandı',
}

export interface LeaveSummary {
  teacher_id: number
  year: number
  totals: Record<string, number>
  annual_leave_quota: number
  annual_leave_quota_source: LeaveQuotaSource
  remaining_annual_leave: number
}
