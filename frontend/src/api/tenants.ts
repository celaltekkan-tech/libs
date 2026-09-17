import client from './client'
import type {
  CreateTenantWizardPayload,
  Tenant,
  TenantListItem,
  TenantSchool,
  TenantUser,
  UpdateTenantPayload,
  UpdateTenantUserPayload,
} from '../types/tenant'

interface Envelope<T> {
  success: true
  data: T
}

export async function listTenants(): Promise<TenantListItem[]> {
  const { data } = await client.get<Envelope<TenantListItem[]>>('/api/tenants')
  return data.data
}

export async function getTenant(id: number): Promise<Tenant> {
  const { data } = await client.get<Envelope<Tenant>>(`/api/tenants/${id}`)
  return data.data
}

export async function listTenantSchools(id: number): Promise<TenantSchool[]> {
  const { data } = await client.get<Envelope<TenantSchool[]>>(`/api/tenants/${id}/schools`)
  return data.data
}

export async function listTenantUsers(id: number): Promise<TenantUser[]> {
  const { data } = await client.get<Envelope<TenantUser[]>>(`/api/tenants/${id}/users`)
  return data.data
}

export async function createTenant(payload: CreateTenantWizardPayload): Promise<void> {
  await client.post('/api/tenants', payload)
}

export async function updateTenant(
  id: number,
  payload: UpdateTenantPayload,
): Promise<{ tenant: Tenant; usersPhoneSynced: number }> {
  const { data } = await client.put<{
    success: true
    data: Tenant
    meta?: { users_phone_synced?: number }
  }>(`/api/tenants/${id}`, payload)
  return {
    tenant: data.data,
    usersPhoneSynced: Number(data.meta?.users_phone_synced || 0),
  }
}

export async function resetTenantTwoFactor(
  id: number,
): Promise<{ tenant_id: number; two_factor_enabled: boolean; reset_user_count: number }> {
  const { data } = await client.post<
    Envelope<{ tenant_id: number; two_factor_enabled: boolean; reset_user_count: number }>
  >(`/api/tenants/${id}/reset-2fa`)
  return data.data
}

export async function resetTenantUserTwoFactor(
  tenantId: number,
  userId: number,
): Promise<{ user_id: number; totp_enabled: boolean }> {
  const { data } = await client.post<Envelope<{ user_id: number; totp_enabled: boolean }>>(
    `/api/tenants/${tenantId}/users/${userId}/reset-2fa`,
  )
  return data.data
}

export async function resetTenantUserSmsLogin(
  tenantId: number,
  userId: number,
): Promise<{ user_id: number; sms_login_requests_count: number }> {
  const { data } = await client.post<
    Envelope<{ user_id: number; sms_login_requests_count: number }>
  >(`/api/tenants/${tenantId}/users/${userId}/reset-sms-login`)
  return data.data
}

export async function updateTenantUser(
  tenantId: number,
  userId: number,
  payload: UpdateTenantUserPayload,
): Promise<TenantUser> {
  const { data } = await client.put<Envelope<TenantUser>>(
    `/api/tenants/${tenantId}/users/${userId}`,
    payload,
  )
  return data.data
}

export async function deleteTenant(id: number): Promise<void> {
  await client.delete(`/api/tenants/${id}`)
}
