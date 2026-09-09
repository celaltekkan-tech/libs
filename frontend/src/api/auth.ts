import client, { persistSession } from './client'
import type { LoginFormValues, LoginResponse, SessionPayload } from '../types/auth'

interface Envelope<T> {
  success: true
  data: T
  message?: string
}

export async function login(values: LoginFormValues): Promise<LoginResponse> {
  const { data } = await client.post<Envelope<LoginResponse>>('/api/auth/login', values)
  persistSession(data.data.token, data.data.expires_at)
  return data.data
}

export async function fetchMe(): Promise<SessionPayload> {
  const { data } = await client.get<Envelope<SessionPayload>>('/api/auth/me')
  return data.data
}

export async function updateProfile(fullName: string): Promise<SessionPayload> {
  const { data } = await client.put<Envelope<SessionPayload>>('/api/auth/profile', {
    full_name: fullName,
  })
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

export async function logout(): Promise<void> {
  try {
    await client.post('/api/auth/logout')
  } catch {
    // İstemci oturumu yine de temizlenir; ağ hatası çıkışı engellemez.
  }
}
