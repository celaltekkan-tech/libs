import type { Classroom } from '../../types/classroom'
import type { Subject } from '../../types/subject'
import type { Teacher } from '../../types/teacher'
import type { TimetableMeta, TimetableProject, TimetableRoom } from '../../types/timetable'

export interface TimetableCtx {
  project: TimetableProject
  classrooms: Classroom[]
  teachers: Teacher[]
  subjects: Subject[]
  rooms: TimetableRoom[]
  meta: TimetableMeta
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  reloadProject: () => Promise<void>
  reloadRooms: () => Promise<void>
}

export function shortClassroom(c?: { class_level: string; section: string } | null): string {
  return c ? `${c.class_level}/${c.section}` : '—'
}

export function teacherFullName(t?: { first_name: string; last_name: string } | null): string {
  return t ? `${t.first_name} ${t.last_name}`.trim() : '—'
}

// Ders adına göre sabit, açık tonlu bir renk (ızgarada dersleri ayırt etmek için).
export function subjectColor(subjectId: number): string {
  const hue = (subjectId * 47) % 360
  return `hsl(${hue} 70% 92%)`
}

export function subjectBorder(subjectId: number): string {
  const hue = (subjectId * 47) % 360
  return `hsl(${hue} 55% 60%)`
}
