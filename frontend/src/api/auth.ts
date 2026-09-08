import client, { persistSession } from './client'
import type { LoginFormValues, LoginResponse, SessionPayload } from '../types/auth'

interface Envelope<T> {
  success: true
  data: T
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

export async function logout(): Promise<void> {
  try {
    await client.post('/api/auth/logout')
  } catch {
    // İstemci oturumu yine de temizlenir; ağ hatası çıkışı engellemez.
  }
}
