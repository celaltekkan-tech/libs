import type { TenantMenuLayout } from './menuLayout'

export interface User {
  id: number
  full_name: string
  email: string
  phone?: string | null
  role: string
  tenant_id: number
  school_id: number | null
  is_active: boolean
  last_login_at: string | null
  totp_enabled?: boolean
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

export interface SmsLicense {
  id: number
  tenant_id: number
  plan: string
  status: string
  starts_at: string
  ends_at: string | null
  sms_quota: number | null
  sms_used: number
  sms_remaining: number | null
}

export interface AiLicense {
  id: number
  plan: string
  starts_at: string
  ends_at: string | null
  ai_daily_limit: number
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
  sms_license?: SmsLicense | null
  ai_license?: AiLicense | null
  modules: string[]
  tenant_two_factor_enabled?: boolean
  tenant_sms_login_enabled?: boolean
  menu_layout?: TenantMenuLayout | null
}

export interface LoginResponse extends SessionPayload {
  token: string
  expires_at: string
}

export interface LoginChallenge2fa {
  requires_2fa: true
  temp_token: string
  expires_at: string
}

export interface LoginChallengeSms {
  requires_sms: true
  temp_token: string
  expires_at: string
  phone_hint: string
  requests_remaining: number
  max_requests: number
}

export type LoginResult = LoginResponse | LoginChallenge2fa | LoginChallengeSms

export function isLoginChallenge2fa(result: LoginResult): result is LoginChallenge2fa {
  return 'requires_2fa' in result && result.requires_2fa === true
}

export function isLoginChallengeSms(result: LoginResult): result is LoginChallengeSms {
  return 'requires_sms' in result && result.requires_sms === true
}

export interface TwoFactorStatus {
  tenant_two_factor_enabled: boolean
  tenant_sms_login_enabled?: boolean
  totp_enabled: boolean
  phone?: string | null
}

export interface TwoFactorSetup {
  secret: string
  otpauth_url: string
  qr_data_url: string
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
