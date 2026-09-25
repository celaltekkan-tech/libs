import client from './client'

interface Envelope<T> {
  success: true
  data: T
}

export interface SmsConfigSummary {
  provider: string
  known: boolean
  settings: Record<string, string | number | boolean | null>
}

export interface SmsTestEntry {
  id: string
  sent_at: string
  duration_ms: number
  phone: string
  message: string
  status: 'basarili' | 'basarisiz' | 'iptal' | 'beklemede'
  provider: string | null
  provider_message_id: string | null
  error: string | null
  sent_by: string | null
}

export interface SmsTestState {
  config: SmsConfigSummary
  history: SmsTestEntry[]
}

export async function getSmsTestState(): Promise<SmsTestState> {
  const { data } = await client.get<Envelope<SmsTestState>>('/api/platform/sms-test')
  return data.data
}

export async function sendSmsTest(payload: { phone: string; message: string }): Promise<SmsTestEntry> {
  const { data } = await client.post<Envelope<SmsTestEntry>>('/api/platform/sms-test', payload)
  return data.data
}
