import client from './client'
import type {
  LinkableTeacher,
  MobileRegisterRequest,
  MobileRegisterRequestStatus,
} from '../types/mobileRegisterRequest'

interface Envelope<T> {
  success: true
  data: T
}

export async function listMobileRegisterRequests(
  status?: MobileRegisterRequestStatus | 'all',
): Promise<MobileRegisterRequest[]> {
  const params = status && status !== 'all' ? { status } : undefined
  const { data } = await client.get<Envelope<MobileRegisterRequest[]>>(
    '/api/users/mobile-register-requests',
    { params },
  )
  return data.data
}

export async function listLinkableTeachers(): Promise<LinkableTeacher[]> {
  const { data } = await client.get<Envelope<LinkableTeacher[]>>(
    '/api/users/mobile-register-requests/teachers',
  )
  return data.data
}

export async function approveMobileRegisterRequest(
  id: number,
  password: string,
  confirmMismatch = false,
  teacherId: number | null = null,
): Promise<MobileRegisterRequest> {
  const { data } = await client.post<Envelope<MobileRegisterRequest>>(
    `/api/users/mobile-register-requests/${id}/approve`,
    { password, confirm_mismatch: confirmMismatch, teacher_id: teacherId },
  )
  return data.data
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
