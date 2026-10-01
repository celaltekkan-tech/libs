import { type SwatchName } from '../theme/objectPalette'

export type CalendarSourceId = 'work_tasks' | string

export interface CalendarEventMeta {
  entity_id?: number
  status?: string
  due_state?: string
  frequency?: string
  is_mandatory?: boolean
  assignee_name?: string | null
  assignee_user_id?: number
  [key: string]: unknown
}

export interface CalendarEvent {
  id: string
  source: CalendarSourceId
  title: string
  start_at: string
  end_at: string | null
  all_day: boolean
  color_key: string
  href: string | null
  meta: CalendarEventMeta
}

export interface CalendarSource {
  id: string
  label: string
  available: boolean
}

/** Menü görünürlüğü: en az bir kaynak izni yeterli. Yeni provider eklenince buraya permission ekleyin. */
export const CALENDAR_MENU_SOURCE_PERMISSIONS = ['work_tasks.read'] as const

export const CALENDAR_SOURCE_LABELS: Record<string, string> = {
  work_tasks: 'İş Takibi',
}

export const CALENDAR_COLOR_KEYS: Record<string, SwatchName> = {
  work_tasks: 'blue',
  work_tasks_due_soon: 'gold',
  work_tasks_overdue: 'red',
  work_tasks_paused: 'neutral',
}
