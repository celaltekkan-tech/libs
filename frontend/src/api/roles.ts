import client from './client'
import type { PermissionCatalog, RolePayload, TenantRole } from '../types/role'

interface Envelope<T> {
  success: true
  data: T
}

export async function fetchPermissionCatalog(): Promise<PermissionCatalog> {
  const { data } = await client.get<Envelope<PermissionCatalog>>('/api/roles/catalog')
  return data.data
}

export async function listRoles(): Promise<TenantRole[]> {
  const { data } = await client.get<Envelope<TenantRole[]>>('/api/roles')
  return data.data
}

export async function createRole(payload: RolePayload): Promise<TenantRole> {
  const { data } = await client.post<Envelope<TenantRole>>('/api/roles', payload)
  return data.data
}

export async function updateRole(id: number, payload: Partial<RolePayload>): Promise<TenantRole> {
  const { data } = await client.put<Envelope<TenantRole>>(`/api/roles/${id}`, payload)
  return data.data
}

export async function deleteRole(id: number): Promise<void> {
  await client.delete(`/api/roles/${id}`)
}
