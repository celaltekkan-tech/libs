import client from './client'
import type { MessageLogListParams, MessageLogListResult } from '../types/messageLog'

interface Envelope<T> {
  success: true
  data: T
  pagination: { page: number; pageSize: number; total: number }
}

export async function listMessageLogs(params: MessageLogListParams = {}): Promise<MessageLogListResult> {
  const { data } = await client.get<Envelope<MessageLogListResult['data']>>('/api/message-logs', { params })
  return { data: data.data, pagination: data.pagination }
}

export async function hideMessageLog(id: number): Promise<void> {
  await client.post(`/api/message-logs/${id}/hide`)
}

export async function unhideMessageLog(id: number): Promise<void> {
  await client.delete(`/api/message-logs/${id}/hide`)
}
