export type LicenseStatus = 'active' | 'cancelled'

export interface License {
  id: number
  tenant_id: number
  plan: string
  status: LicenseStatus
  starts_at: string
  ends_at: string | null
  cancelled_at: string | null
  notes: string | null
  sms_quota?: number | null
  sms_used?: number
  sms_remaining?: number | null
  /** Yapay Zekâ eklentisi: lisansa özel günlük sınır; null = sistem varsayılanı, 0 = sınırsız */
  ai_daily_limit?: number | null
  /** Geçerli sınır (varsayılan çözülmüş hali) */
  ai_effective_limit?: number
  ai_used_today?: number
  created_at: string
  updated_at: string
  Tenant?: { id: number; name: string } | null
}

export interface CreateLicensePayload {
  tenant_id: number
  plan: string
  starts_at?: string
  ends_at?: string | null
  notes?: string
  sms_quota?: number | null
  ai_daily_limit?: number | null
}
