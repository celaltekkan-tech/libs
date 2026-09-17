export type WorkTaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type WorkTaskStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type NotifyChannel = 'in_app' | 'sms' | 'email'
export type WorkTaskDueState =
  | 'upcoming'
  | 'due_soon'
  | 'overdue'
  | 'done_period'
  | 'completed'
  | 'cancelled'

export interface WorkTaskRecurrenceConfig {
  weekday?: number
  day?: number
  month?: number
}

export interface WorkTaskUserRef {
  id: number
  full_name: string
  email?: string
  phone?: string | null
}

export interface WorkTask {
  id: number
  tenant_id: number
  title: string
  description: string | null
  assignee_user_id: number
  created_by: number | null
  frequency: WorkTaskFrequency
  recurrence_config: WorkTaskRecurrenceConfig | null
  next_due_at: string
  remind_before_minutes: number
  is_mandatory: boolean
  notify_channels: NotifyChannel[]
  status: WorkTaskStatus
  last_completed_at: string | null
  due_state: WorkTaskDueState
  Assignee?: WorkTaskUserRef
  Creator?: WorkTaskUserRef
}

export interface WorkTaskListParams {
  mine?: boolean
  overdue?: boolean
  mandatory?: boolean
  status?: WorkTaskStatus
}

export interface WorkTaskPayload {
  title: string
  description?: string | null
  assignee_user_id: number
  frequency: WorkTaskFrequency
  recurrence_config?: WorkTaskRecurrenceConfig | null
  next_due_at: string
  remind_before_minutes?: number
  is_mandatory?: boolean
  notify_channels?: NotifyChannel[]
  status?: WorkTaskStatus
}

export const FREQUENCY_LABELS: Record<WorkTaskFrequency, string> = {
  once: 'Tek sefer',
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
}

export const NOTIFY_CHANNEL_OPTIONS: Array<{ value: NotifyChannel; label: string }> = [
  { value: 'in_app', label: 'Uygulama bildirimi' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'E-posta' },
]
