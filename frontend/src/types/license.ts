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
}
