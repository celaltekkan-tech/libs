import type { ScheduleTeacherOption } from '../api/schedule'
import type { CommitteeMember } from '../types/exam'

interface SubjectMatch {
  subject_id: number | null
  subject_name: string
}

export interface SchoolLanguages {
  first: string | null
  second: string | null
}

interface DutySlot {
  exam_date: string | null
  oral_exam_date?: string | null
  teacher_id: number | null
  student_count?: number
  committee_members: CommitteeMember[] | null
}

export type ExamKind = 'yazili' | 'sozlu'

export function foldName(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ')
}

export function isDualSubject(name: string): boolean {
  const n = name.toLocaleLowerCase('tr-TR')
  if (n.includes('ingilizce')) return true
  if (n.includes('yabancı dil')) return true
  if (n.includes('türk dili') || n.includes('edebiyat')) return true
  return /(^|[^a-zçğıöşü])türkçe([^a-zçğıöşü]|$)/.test(n)
}

export function proctorCount(studentCount: number): number {
  if (studentCount < 30) return 0
  return Math.floor(studentCount / 30)
}

function languageAliases(subjectName: string, languages?: SchoolLanguages | null): string[] {
  if (!languages) return []
  const name = foldName(subjectName).replace(/^seçmeli\s+/, '')
  if (name.includes('ikinci yabancı dil')) {
    return languages.second ? [foldName(languages.second)] : []
  }
  if (name.includes('yabancı dil')) {
    return languages.first ? [foldName(languages.first)] : []
  }
  return []
}

export function teacherMatchesSubject(
  teacher: ScheduleTeacherOption,
  slot: SubjectMatch,
  languages?: SchoolLanguages | null,
): boolean {
  if (slot.subject_id != null && teacher.subject_ids.includes(slot.subject_id)) return true
  const target = foldName(slot.subject_name)
  const aliases = languageAliases(slot.subject_name, languages)
  return teacher.subject_names.some((name) => {
    const n = foldName(name)
    if (n === target || target.includes(n) || n.includes(target)) return true
    return aliases.includes(n)
  })
}

export function suggestMembers(
  slot: SubjectMatch,
  teachers: ScheduleTeacherOption[],
  excludeIds: number[] = [],
  languages?: SchoolLanguages | null,
  count = 2,
): ScheduleTeacherOption[] {
  return teachers
    .filter((teacher) => !excludeIds.includes(teacher.id) && teacherMatchesSubject(teacher, slot, languages))
    .slice(0, count)
}

export function suggestMember(
  slot: SubjectMatch,
  teachers: ScheduleTeacherOption[],
  excludeIds: number[] = [],
  languages?: SchoolLanguages | null,
): ScheduleTeacherOption | null {
  return suggestMembers(slot, teachers, excludeIds, languages, 1)[0] || null
}

export function suggestProctors(
  slot: SubjectMatch & { student_count: number },
  teachers: ScheduleTeacherOption[],
  excludeIds: number[],
  languages?: SchoolLanguages | null,
): ScheduleTeacherOption[] {
  const count = proctorCount(slot.student_count)
  if (count <= 0) return []
  const pool = teachers.filter((teacher) => !excludeIds.includes(teacher.id))
  const others = pool.filter((teacher) => !teacherMatchesSubject(teacher, slot, languages))
  const same = pool.filter((teacher) => teacherMatchesSubject(teacher, slot, languages))
  return [...others, ...same].slice(0, count)
}

export function dutyCounts(slots: DutySlot[]): Map<number, number> {
  const counts = new Map<number, number>()
  const add = (id?: number | null) => {
    if (!id) return
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  for (const slot of slots) {
    const members = slot.committee_members || []
    if (slot.exam_date) {
      if (members.length) members.forEach((member) => add(member.teacher_id))
      else add(slot.teacher_id)
    }
    if (slot.oral_exam_date) {
      const spoken = members.filter((member) => member.role !== 'gozetmen')
      if (spoken.length) spoken.forEach((member) => add(member.teacher_id))
      else add(slot.teacher_id)
    }
  }
  return counts
}

export function roleLabel(role: CommitteeMember['role']): string {
  if (role === 'baskan') return 'Başkan'
  if (role === 'gozetmen') return 'Gözetmen'
  return 'Üye'
}
