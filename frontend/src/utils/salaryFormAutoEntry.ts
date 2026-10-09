import type { Dayjs } from 'dayjs'
import { appendSalaryFormRow } from '../api/salaryForm'
import type { SalaryFormDepartureRow, SalaryFormStarterRow } from '../types/salaryForm'

/**
 * Formun dönemi önceki ayın 15'i – bu ayın 14'üdür; form bitiş ayıyla anılır.
 * Ayın 15'i ve sonrası sonraki ayın formuna girer (backend: src/utils/salaryPeriod.js).
 */
export function periodFrom(date: Dayjs) {
  const next = date.date() >= 15 ? date.add(1, 'month') : date
  return { month: next.month() + 1, year: next.year() }
}

/** Ayrılan personeli, ilgili ayın Maaş Değişikliği Bildirim Formu taslağına (B bölümü) ekler. */
export async function addSalaryFormDeparture(date: Dayjs, row: SalaryFormDepartureRow) {
  const { month, year } = periodFrom(date)
  await appendSalaryFormRow(month, year, 'departures', row)
}

/** Yeni başlayan personeli, ilgili ayın Maaş Değişikliği Bildirim Formu taslağına (C bölümü) ekler. */
export async function addSalaryFormStarter(date: Dayjs, row: SalaryFormStarterRow) {
  const { month, year } = periodFrom(date)
  await appendSalaryFormRow(month, year, 'starters', row)
}
