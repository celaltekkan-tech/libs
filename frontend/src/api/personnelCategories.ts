import client from './client'
import type { PersonnelCategory, PersonnelCategoryPayload } from '../types/personnelCategory'

interface Envelope<T> {
  success: true
  data: T
}

export async function listPersonnelCategories(): Promise<PersonnelCategory[]> {
  const { data } = await client.get<Envelope<PersonnelCategory[]>>('/api/personnel-categories')
  return data.data
}

export async function createPersonnelCategory(payload: PersonnelCategoryPayload): Promise<PersonnelCategory> {
  const { data } = await client.post<Envelope<PersonnelCategory>>('/api/personnel-categories', payload)
  return data.data
}

export async function updatePersonnelCategory(
  id: number,
  payload: Partial<PersonnelCategoryPayload>,
): Promise<PersonnelCategory> {
  const { data } = await client.put<Envelope<PersonnelCategory>>(`/api/personnel-categories/${id}`, payload)
  return data.data
}

export async function deletePersonnelCategory(id: number): Promise<void> {
  await client.delete(`/api/personnel-categories/${id}`)
}
