import client from './client'
import type { CalendarEvent, CalendarSource } from '../types/calendarEvent'

interface Envelope<T> {
  success: true
  data: T
}

export async function listCalendarSources(): Promise<CalendarSource[]> {
  const { data } = await client.get<Envelope<CalendarSource[]>>('/api/calendar/sources')
  return data.data
}

export async function listCalendarEvents(params: {
  from: string
  to: string
  sources?: string[]
}): Promise<CalendarEvent[]> {
  const { data } = await client.get<Envelope<CalendarEvent[]>>('/api/calendar/events', {
    params: {
      from: params.from,
      to: params.to,
      sources: params.sources?.length ? params.sources.join(',') : undefined,
    },
  })
  return data.data
}
