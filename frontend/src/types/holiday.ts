export interface Holiday {
  id: number
  tenant_id: number
  name: string
  month: number
  day: number
  year: number | null
  created_at: string
  updated_at: string
}

/** Tek gün (ay/gün/yıl) veya tarih aralığı ile ekleme. */
export type HolidayPayload =
  | {
      name: string
      month: number
      day: number
      year?: number | null
    }
  | {
      name: string
      start_date: string
      end_date: string
      /** Yalnızca tek gün için: year=null (her yıl). */
      recurring?: boolean
    }
