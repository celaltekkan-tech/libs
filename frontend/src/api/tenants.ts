import client from './client'
import type {
  CreateTenantWizardPayload,
  Tenant,
  TenantListItem,
  TenantSchool,
  TenantUser,
  UpdateTenantPayload,
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

export async function updateTenant(id: number, payload: UpdateTenantPayload): Promise<Tenant> {
  const { data } = await client.put<Envelope<Tenant>>(`/api/tenants/${id}`, payload)
  return data.data
}

export async function deleteTenant(id: number): Promise<void> {
  await client.delete(`/api/tenants/${id}`)
}
