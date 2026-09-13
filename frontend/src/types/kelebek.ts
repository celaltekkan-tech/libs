export type SeatType = 'ikili' | 'tekli'

export interface SeatingLayoutGroup {
  name: string
  rows: number
  /** Sütun sayısı kadar eleman; her biri o sütunun aktif olup olmadığını belirtir. */
  columns: boolean[]
  /** row*columns.length+col şeklindeki slot indeksleri — iptal edilmiş tekil sıralar. */
  disabled_seats: number[]
}

export interface SeatingLayout {
  seat_type: SeatType
  groups: SeatingLayoutGroup[]
}

export function computeSeatingCapacity(layout: SeatingLayout | null | undefined): number {
  if (!layout || !Array.isArray(layout.groups)) return 0
  let total = 0
  for (const group of layout.groups) {
    const columns = Array.isArray(group.columns) ? group.columns : []
    const disabled = new Set(group.disabled_seats || [])
    for (let r = 0; r < group.rows; r += 1) {
      for (let c = 0; c < columns.length; c += 1) {
        if (!columns[c]) continue
        if (disabled.has(r * columns.length + c)) continue
        total += 1
      }
    }
  }
  return total
}

export interface ExamRoom {
  id: number
  tenant_id: number
  school_id: number | null
  name: string
  capacity: number
  building: string | null
  floor: string | null
  is_active: boolean
  seating_layout: SeatingLayout | null
  created_at: string
  updated_at: string
}

export interface ExamRoomPayload {
  school_id?: number | null
  name: string
  building?: string | null
  floor?: string | null
  is_active?: boolean
  seating_layout?: SeatingLayout | null
  capacity?: number
}

export interface ExamSession {
  id: number
  tenant_id: number
  school_id: number | null
  name: string
  exam_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ExamSessionPayload {
  school_id?: number | null
  name: string
  exam_date: string
  notes?: string | null
}

export interface SeatAssignment {
  id: number
  exam_session_id: number
  exam_room_id: number
  student_id: number
  seat_no: number
  classroom_label: string | null
  present: boolean | null
  ExamRoom?: { id: number; name: string } | null
  Student?: { id: number; first_name: string; last_name: string; student_number: string | null } | null
}

export interface ProctorAssignment {
  id: number
  exam_session_id: number
  exam_room_id: number
  teacher_id: number
  ExamRoom?: { id: number; name: string } | null
  Teacher?: { id: number; first_name: string; last_name: string } | null
}
