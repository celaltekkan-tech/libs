import type { Dayjs } from 'dayjs'
import { appendSalaryFormRow } from '../api/salaryForm'
import type { SalaryFormDepartureRow, SalaryFormStarterRow } from '../types/salaryForm'

function periodFrom(date: Dayjs) {
  return { month: date.month() + 1, year: date.year() }
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
