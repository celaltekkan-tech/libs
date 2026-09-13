import type { SchoolType } from './school'

export interface Tenant {
  id: number
  name: string
  plan: string | null
  is_active: boolean
  two_factor_enabled?: boolean
  created_at: string
  updated_at: string
}

export interface TenantListItem extends Tenant {
  school_count: number
  user_count: number
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
  role: string
  is_active: boolean
  last_login_at: string | null
  totp_enabled?: boolean
}

export interface CreateTenantWizardPayload {
  tenant: {
    name: string
    plan?: string
  }
  school: {
    name: string
    code: string
    school_type: SchoolType
  }
  admin: {
    full_name: string
    email: string
    password: string
  }
}

export interface UpdateTenantPayload {
  name?: string
  plan?: string | null
  is_active?: boolean
  two_factor_enabled?: boolean
}
