import client from './client'

interface Envelope<T> {
  success: true
  data: T
}

export interface OnlinePresence {
  online_tenants: number
  online_users: number
}

export async function pingPresence(): Promise<void> {
  await client.post('/api/auth/presence')
}

export async function getOnlinePresence(): Promise<OnlinePresence> {
  const { data } = await client.get<Envelope<OnlinePresence>>('/api/platform/presence')
  return data.data
}
