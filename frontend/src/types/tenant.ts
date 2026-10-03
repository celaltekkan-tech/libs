import type { SchoolType } from './school'

export interface Tenant {
  id: number
  name: string
  phone?: string | null
  plan: string | null
  is_active: boolean
  two_factor_enabled?: boolean
  sms_login_enabled?: boolean
  feedback_enabled?: boolean
  is_demo?: boolean
  created_at: string
  updated_at: string
  last_login_at?: string | null
}

export interface TenantListItem extends Tenant {
  school_count: number
  user_count: number
}

export interface DemoResetStatus {
  tenant_id: number | null
  tenant_name: string | null
  schedule_time: string
  timezone: string
  has_snapshot: boolean
  snapshot_taken_at: string | null
  last_reset_at: string | null
  last_reset_trigger: 'manual' | 'scheduled' | null
  last_reset_summary: { restored?: boolean; added?: string[] } | null
}

export interface DemoResetResult {
  tenant_id: number
  tenant_name: string
  restored?: boolean
  added: string[]
  snapshot_taken_at?: string
}

export interface TenantSchool {
  id: number
  tenant_id: number
  name: string
  code: string
  school_type: SchoolType
  created_at: string
}

export interface TenantUser {
  id: number
  tenant_id: number
  school_id: number | null
  full_name: string
  email: string
  phone?: string | null
  role: string
  is_active: boolean
  last_login_at: string | null
  totp_enabled?: boolean
  sms_login_requests_count?: number
  sms_login_requests_date?: string | null
  login_failed_count?: number
  login_locked_until?: string | null
}

export interface BannedAccount {
  user_id: number
  tenant_id: number
  tenant_name: string | null
  full_name: string
  email: string
  role: string
  banned_at: string | null
  banned_until: string | null
  ip_address: string | null
  failed_count: number
}

export interface CreateTenantWizardPayload {
  tenant: {
    name: string
    phone?: string | null
  }
  school: {
    name: string
    code: string
    school_type: SchoolType
    province_id?: number | null
    district_id?: number | null
    directory_school_id?: number | null
    principal_name?: string | null
  }
  admin: {
    full_name: string
    email: string
    password: string
    phone?: string | null
    school_role: 'Müdür' | 'Müdür Yardımcısı'
  }
}

export interface UpdateTenantPayload {
  name?: string
  plan?: string | null
  phone?: string | null
  is_active?: boolean
  two_factor_enabled?: boolean
  sms_login_enabled?: boolean
  feedback_enabled?: boolean
}

export interface UpdateTenantUserPayload {
  full_name?: string
  email?: string
  phone?: string | null
}
