export interface User {
  id: number
  full_name: string
  email: string
  role: string
  tenant_id: number
  school_id: number | null
  is_active: boolean
  last_login_at: string | null
}

export interface SchoolAssignment {
  id: number
  name: string
  code: string
  role: string | null
}

export type LicenseStatus = 'active' | 'expired' | 'exempt'

export interface ActiveLicense {
  id: number
  tenant_id: number
  plan: string
  status: string
  starts_at: string
  ends_at: string | null
}

export interface SessionPayload {
  user: User
  roles: string[]
  permissions: string[]
  schools: SchoolAssignment[]
  is_global_admin: boolean
  is_platform_admin: boolean
  license_status: LicenseStatus
  license: ActiveLicense | null
  modules: string[]
}

export interface LoginResponse extends SessionPayload {
  token: string
  expires_at: string
}

export interface ApiErrorBody {
  success: false
  code?: string
  message?: string
  errors?: Array<{ field: string; message: string }>
}

export interface LoginFormValues {
  email: string
  password: string
}
