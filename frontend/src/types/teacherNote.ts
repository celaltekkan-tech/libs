import type { DisciplineStudent } from './discipline'

export interface TeacherNote {
  id: number
  tenant_id: number
  school_id: number | null
  student_id: number
  teacher_id: number
  tags: string[]
  note: string | null
  Student?: DisciplineStudent | null
  Teacher?: { id: number; full_name: string } | null
  created_at: string
  updated_at: string
}
