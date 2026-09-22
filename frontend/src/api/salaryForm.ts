import client from './client'
import type {
  SalaryFormDepartureRow,
  SalaryFormDraftPayload,
  SalaryFormDraftResponse,
  SalaryFormStarterRow,
} from '../types/salaryForm'

interface Envelope<T> {
  success: true
  data: T
  message?: string
}

export type SalaryFormExportFormat = 'xlsx' | 'pdf'

export async function getSalaryFormDraft(month: number, year: number): Promise<SalaryFormDraftResponse> {
  const { data } = await client.get<Envelope<SalaryFormDraftResponse>>('/api/salary-form/draft', {
    params: { month, year },
  })
  return data.data
}

export async function saveSalaryFormDraft(
  month: number,
  year: number,
  payload: SalaryFormDraftPayload,
): Promise<SalaryFormDraftResponse> {
  const { data } = await client.put<Envelope<SalaryFormDraftResponse>>('/api/salary-form/draft', {
    month,
    year,
    payload,
  })
  return data.data
}

/**
 * Tek bir satırı (ayrılan/başlayan personel vb.) taslağa ekler. upsertDraft'tan farklı
 * olarak tüm payload'ı göndermez — sunucuda transaction + row lock ile eklenir, böylece
 * başka bir sekmede açık duran eski bir taslak kopyası bu satırı "Kaydet" ile ezemez.
 */
export async function appendSalaryFormRow(
  month: number,
  year: number,
  section: 'departures' | 'starters',
  row: SalaryFormDepartureRow | SalaryFormStarterRow,
): Promise<SalaryFormDraftResponse> {
  const { data } = await client.post<Envelope<SalaryFormDraftResponse>>('/api/salary-form/draft/append', {
    month,
    year,
    section,
    row,
  })
  return data.data
}

export async function downloadSalaryForm(
  month: number,
  year: number,
  format: SalaryFormExportFormat = 'xlsx',
  options?: { inline?: boolean },
): Promise<Blob> {
  const { data } = await client.get('/api/salary-form/export', {
    params: {
      month,
      year,
      format,
      ...(options?.inline ? { inline: 1 } : {}),
    },
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}
