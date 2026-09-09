export interface ExamRoom {
  id: number
  tenant_id: number
  school_id: number | null
  name: string
  capacity: number
  created_at: string
  updated_at: string
}

export interface ExamRoomPayload {
  school_id?: number | null
  name: string
  capacity: number
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
