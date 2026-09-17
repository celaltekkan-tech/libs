import type { Dayjs } from 'dayjs'
import { getSalaryFormDraft, saveSalaryFormDraft } from '../api/salaryForm'
import type { SalaryFormDepartureRow, SalaryFormStarterRow } from '../types/salaryForm'

function periodFrom(date: Dayjs) {
  return { month: date.month() + 1, year: date.year() }
}

/** Ayrılan personeli, ilgili ayın Maaş Değişikliği Bildirim Formu taslağına (B bölümü) ekler. */
export async function addSalaryFormDeparture(date: Dayjs, row: SalaryFormDepartureRow) {
  const { month, year } = periodFrom(date)
  const { payload } = await getSalaryFormDraft(month, year)
  await saveSalaryFormDraft(month, year, {
    ...payload,
    departures: [...(payload.departures || []), row],
  })
}

/** Yeni başlayan personeli, ilgili ayın Maaş Değişikliği Bildirim Formu taslağına (C bölümü) ekler. */
export async function addSalaryFormStarter(date: Dayjs, row: SalaryFormStarterRow) {
  const { month, year } = periodFrom(date)
  const { payload } = await getSalaryFormDraft(month, year)
  await saveSalaryFormDraft(month, year, {
    ...payload,
    starters: [...(payload.starters || []), row],
  })
}
