export interface ClassroomTeacher {
  id: number
  first_name: string
  last_name: string
  personnel_no: string | null
}

export interface ClassroomSchool {
  id: number
  name: string
  code: string
}

export interface Classroom {
  id: number
  tenant_id: number
  school_id: number | null
  class_level: string
  section: string
  teacher_id: number | null
  academic_year: string | null
  is_active: boolean
  Teacher?: ClassroomTeacher | null
  School?: ClassroomSchool | null
  created_at: string
  updated_at: string
}

export interface ClassroomPayload {
  school_id?: number | null
  class_level: string
  section: string
  teacher_id?: number | null
  academic_year?: string | null
  is_active?: boolean
}

export function classroomLabel(c: Pick<Classroom, 'class_level' | 'section' | 'academic_year'>): string {
  const base = `${c.class_level}/${c.section}`
  return c.academic_year ? `${base} (${c.academic_year})` : base
}
