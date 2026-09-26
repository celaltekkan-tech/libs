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

/** Lise listeleri 9, 10, 11, 12 diye gider. 1-8. sınıflar bunların ardından gelir. */
export function gradeOrder(level: string | null | undefined): number {
  const n = Number.parseInt(String(level ?? '').trim(), 10)
  if (!Number.isFinite(n)) return 2000
  if (n >= 9) return n
  return 1000 + n
}

export function compareClassrooms<T extends { class_level?: string | null; section?: string | null }>(
  a: T,
  b: T,
): number {
  const g = gradeOrder(a.class_level) - gradeOrder(b.class_level)
  if (g) return g
  return String(a.section || '').localeCompare(String(b.section || ''), 'tr', { sensitivity: 'base' })
}

export function sortClassrooms<T extends { class_level?: string | null; section?: string | null }>(rows: T[]): T[] {
  return [...rows].sort(compareClassrooms)
}
