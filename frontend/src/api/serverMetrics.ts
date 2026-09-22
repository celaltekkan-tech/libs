import client from './client'
import type { ServerMetrics } from '../types/serverMetrics'

interface Envelope<T> {
  success: true
  data: T
}

export async function getServerMetrics(): Promise<ServerMetrics> {
  const { data } = await client.get<Envelope<ServerMetrics>>('/api/platform/metrics')
  return data.data
}
