import client, { persistSession } from './client'
import type {
  LoginFormValues,
  LoginResult,
  LoginResponse,
  LoginChallengeSms,
  SessionPayload,
  TwoFactorSetup,
  TwoFactorStatus,
} from '../types/auth'
import type { TenantMenuLayout } from '../types/menuLayout'

interface Envelope<T> {
  success: true
  data: T
  message?: string
}

export async function login(values: LoginFormValues): Promise<LoginResult> {
  const { data } = await client.post<Envelope<LoginResult>>('/api/auth/login', values)
  if ('requires_2fa' in data.data && data.data.requires_2fa) {
    return data.data
  }
  if ('requires_sms' in data.data && data.data.requires_sms) {
    return data.data
  }
  const session = data.data as LoginResponse
  persistSession(session.token, session.expires_at)
  return session
}

export async function verify2fa(tempToken: string, code: string): Promise<LoginResponse> {
  const { data } = await client.post<Envelope<LoginResponse>>('/api/auth/verify-2fa', {
    temp_token: tempToken,
    code,
  })
  persistSession(data.data.token, data.data.expires_at)
  return data.data
}

export async function verifySms(tempToken: string, code: string): Promise<LoginResponse> {
  const { data } = await client.post<Envelope<LoginResponse>>('/api/auth/verify-sms', {
    temp_token: tempToken,
    code,
  })
  persistSession(data.data.token, data.data.expires_at)
  return data.data
}

export async function resendSms(tempToken: string): Promise<LoginChallengeSms> {
  const { data } = await client.post<Envelope<LoginChallengeSms>>('/api/auth/resend-sms', {
    temp_token: tempToken,
  })
  return data.data
}

export async function fetchMe(): Promise<SessionPayload> {
  const { data } = await client.get<Envelope<SessionPayload>>('/api/auth/me')
  return data.data
}

export async function updateProfile(payload: {
  full_name: string
  phone?: string | null
}): Promise<SessionPayload> {
  const { data } = await client.put<Envelope<SessionPayload>>('/api/auth/profile', payload)
  return data.data
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ token: string; expires_at: string }> {
  const { data } = await client.post<Envelope<{ token: string; expires_at: string }>>(
    '/api/auth/change-password',
    {
      current_password: currentPassword,
      new_password: newPassword,
    },
  )
  persistSession(data.data.token, data.data.expires_at)
  return data.data
}

export async function get2faStatus(): Promise<TwoFactorStatus> {
  const { data } = await client.get<Envelope<TwoFactorStatus>>('/api/auth/2fa')
  return data.data
}

export async function setup2fa(): Promise<TwoFactorSetup> {
  const { data } = await client.post<Envelope<TwoFactorSetup>>('/api/auth/2fa/setup')
  return data.data
}

export async function confirm2fa(code: string): Promise<{ backup_codes: string[] }> {
  const { data } = await client.post<Envelope<{ backup_codes: string[] }>>('/api/auth/2fa/confirm', {
    code,
  })
  return data.data
}

export async function disable2fa(password: string, code: string): Promise<void> {
  await client.post('/api/auth/2fa/disable', { password, code })
}

export async function getTenantTwoFactorSetting(): Promise<{ two_factor_enabled: boolean }> {
  const { data } = await client.get<Envelope<{ two_factor_enabled: boolean }>>('/api/auth/tenant-2fa')
  return data.data
}

export async function updateTenantTwoFactorSetting(payload: {
  two_factor_enabled?: boolean
  sms_login_enabled?: boolean
}): Promise<{ two_factor_enabled: boolean; sms_login_enabled: boolean }> {
  const { data } = await client.put<
    Envelope<{ two_factor_enabled: boolean; sms_login_enabled: boolean }>
  >('/api/auth/tenant-2fa', payload)
  return data.data
}

export async function getMenuLayout(): Promise<{ layout: TenantMenuLayout | null }> {
  const { data } = await client.get<Envelope<{ layout: TenantMenuLayout | null }>>(
    '/api/auth/menu-layout',
  )
  return data.data
}

export async function updateMenuLayout(
  layout: TenantMenuLayout | null,
): Promise<{ layout: TenantMenuLayout | null }> {
  const { data } = await client.put<Envelope<{ layout: TenantMenuLayout | null }>>(
    '/api/auth/menu-layout',
    { layout },
  )
  return data.data
}

export async function logout(): Promise<void> {
  try {
    await client.post('/api/auth/logout')
  } catch {
    // İstemci oturumu yine de temizlenir; ağ hatası çıkışı engellemez.
  }
}
