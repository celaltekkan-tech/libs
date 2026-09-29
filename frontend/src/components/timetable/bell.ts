import type { BellSchedule } from '../../types/timetable'
import { DEFAULT_BELL } from '../../types/timetable'

function parseMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '')
  if (!match) return 8 * 60 + 30
  return Number(match[1]) * 60 + Number(match[2])
}

function formatMinutes(total: number): string {
  const minutes = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function gapMinutes(schedule: BellSchedule, day: number, afterPeriod: number, lunchAfter: number | null): number {
  const extra = schedule.day_breaks.find((item) => item.day === day && item.after_period === afterPeriod)
  if (extra) return extra.minutes
  const listed = schedule.breaks?.[afterPeriod - 1]
  const base = listed == null ? schedule.break_minutes : listed
  if (lunchAfter === afterPeriod) return Math.max(base, 30)
  return base
}

export function periodClock(bell: BellSchedule | undefined, day: number, period: number, lunchAfter: number | null): string {
  const schedule = { ...DEFAULT_BELL, ...(bell || {}), day_breaks: bell?.day_breaks || [], breaks: bell?.breaks || [] }
  let cursor = parseMinutes(schedule.start_time)
  for (let current = 1; current < period; current += 1) {
    cursor += schedule.lesson_minutes
    cursor += gapMinutes(schedule, day, current, lunchAfter)
  }
  return formatMinutes(cursor)
}
