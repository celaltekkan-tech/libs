import client from './client'
import type { ManagedUser, ManagedUserPayload, UserFormOptions } from '../types/managedUser'

interface Envelope<T> {
  success: true
  data: T
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const { data } = await client.get<Envelope<ManagedUser[]>>('/api/users')
  return data.data
}

export async function fetchUserFormOptions(): Promise<UserFormOptions> {
  const { data } = await client.get<Envelope<UserFormOptions>>('/api/users/form-options')
  return data.data
}

export async function createManagedUser(
  tenantId: number,
  payload: ManagedUserPayload,
): Promise<ManagedUser> {
  const { data } = await client.post<Envelope<ManagedUser>>('/api/users', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateManagedUser(
  id: number,
  payload: ManagedUserPayload,
): Promise<ManagedUser> {
  const { data } = await client.put<Envelope<ManagedUser>>(`/api/users/${id}`, payload)
  return data.data
}

export async function deleteManagedUser(id: number): Promise<void> {
  await client.delete(`/api/users/${id}`)
}
