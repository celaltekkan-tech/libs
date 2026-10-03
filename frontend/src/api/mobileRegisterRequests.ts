import client from './client'
import type {
  AssignableRole,
  LinkableTeacher,
  MobileRegisterRequest,
  MobileRegisterRequestStatus,
} from '../types/mobileRegisterRequest'

interface Envelope<T> {
  success: true
  data: T
}

export async function listMobileRegisterRequests(params?: {
  status?: MobileRegisterRequestStatus | 'all'
  q?: string
  visibility?: 'visible' | 'hidden'
}): Promise<MobileRegisterRequest[]> {
  const query: Record<string, string> = {}
  if (params?.status && params.status !== 'all') query.status = params.status
  if (params?.q?.trim()) query.q = params.q.trim()
  if (params?.visibility) query.visibility = params.visibility
  const { data } = await client.get<Envelope<MobileRegisterRequest[]>>(
    '/api/users/mobile-register-requests',
    { params: query },
  )
  return data.data
}

export async function setMobileRegisterVisibility(id: number, hidden: boolean): Promise<MobileRegisterRequest> {
  const { data } = await client.post<Envelope<MobileRegisterRequest>>(
    `/api/users/mobile-register-requests/${id}/visibility`,
    { hidden },
  )
  return data.data
}

export async function listLinkableTeachers(): Promise<LinkableTeacher[]> {
  const { data } = await client.get<Envelope<LinkableTeacher[]>>(
    '/api/users/mobile-register-requests/teachers',
  )
  return data.data
}

export async function listAssignableRoles(): Promise<AssignableRole[]> {
  const { data } = await client.get<Envelope<AssignableRole[]>>('/api/users/mobile-register-requests/roles')
  return data.data
}

export async function approveMobileRegisterRequest(
  id: number,
  password: string,
  confirmMismatch = false,
  teacherId: number | null = null,
  roleId: number | null = null,
): Promise<MobileRegisterRequest> {
  const { data } = await client.post<Envelope<MobileRegisterRequest>>(
    `/api/users/mobile-register-requests/${id}/approve`,
    { password, confirm_mismatch: confirmMismatch, teacher_id: teacherId, role_id: roleId },
  )
  return data.data
}

export async function listPlatformMobileRegisterRequests(params?: {
  status?: MobileRegisterRequestStatus | 'all'
  q?: string
  visibility?: 'visible' | 'hidden' | 'all'
  tenant_id?: number
}): Promise<MobileRegisterRequest[]> {
  const query: Record<string, string> = {}
  if (params?.status && params.status !== 'all') query.status = params.status
  if (params?.q?.trim()) query.q = params.q.trim()
  if (params?.visibility) query.visibility = params.visibility
  if (params?.tenant_id) query.tenant_id = String(params.tenant_id)
  const { data } = await client.get<Envelope<MobileRegisterRequest[]>>(
    '/api/platform/mobile-register-requests',
    { params: query },
  )
  return data.data
}

export async function setPlatformMobileRegisterVisibility(
  id: number,
  hidden: boolean,
): Promise<MobileRegisterRequest> {
  const { data } = await client.post<Envelope<MobileRegisterRequest>>(
    `/api/platform/mobile-register-requests/${id}/visibility`,
    { hidden },
  )
  return data.data
}

export async function deletePlatformMobileRegisterRequest(id: number): Promise<void> {
  await client.delete(`/api/platform/mobile-register-requests/${id}`)
}

export async function rejectMobileRegisterRequest(
  id: number,
  reason?: string,
): Promise<MobileRegisterRequest> {
  const { data } = await client.post<Envelope<MobileRegisterRequest>>(
    `/api/users/mobile-register-requests/${id}/reject`,
    { reason: reason || null },
  )
  return data.data
}
