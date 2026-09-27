import type { Classroom } from '../../types/classroom'
import type { Subject } from '../../types/subject'
import type { Teacher } from '../../types/teacher'
import { teacherTitleParts } from '../../utils/teacherTitle'
import { foldName, type SchoolLanguages } from '../../utils/sorumlulukExam'
import { gradeOrder } from '../../types/classroom'
import type { TimetableAssignment, TimetableMeta, TimetableProject, TimetableRoom } from '../../types/timetable'

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

/** Rehberlik ayrı bir derstir; branşı ne olursa olsun her öğretmen girebilir. */
export function isGuidanceLesson(name?: string | null): boolean {
  return String(name || '').toLocaleLowerCase('tr-TR').includes('rehberlik')
}

/** Ders programı sayfasıyla aynı dolgu: açık mavi, koyu temada tema yüzeyi. */
export function subjectColor(_subjectId: number, dark = false): string {
  return dark ? '#111a2c' : '#f0f5ff'
}

export function subjectBorder(_subjectId: number, dark = false): string {
  return dark ? '#3c89e8' : '#1677ff'
}

/** 1. öğretmen + ortak öğretmenler (tekrarsız). */
export function assignmentTeacherIds(a: Pick<TimetableAssignment, 'teacher_id' | 'co_teacher_ids'>): number[] {
  const out: number[] = []
  for (const id of [a.teacher_id, ...(a.co_teacher_ids || [])]) {
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

/** Şubelerde geçen sınıf seviyeleri (küçükten büyüğe); şube yoksa lise seviyeleri. */
export function classLevels(classrooms: Array<{ class_level: string }>): string[] {
  const levels = [...new Set(classrooms.map((c) => c.class_level).filter(Boolean))]
  if (!levels.length) return ['9', '10', '11', '12']
  return levels.sort((a, b) => gradeOrder(a) - gradeOrder(b) || a.localeCompare(b, 'tr', { numeric: true }))
}

/** Ders adı ve okulun yabancı dillerinden eşleşecek branş adları. */
export function lessonBranchTargets(subjectName: string, languages?: SchoolLanguages | null): string[] {
  const name = foldName(subjectName).replace(/^seçmeli\s+/, '')
  const targets = new Set<string>()
  if (name) targets.add(name)
  if (languages) {
    if (name.includes('ikinci yabancı dil') || name.includes('2. yabancı')) {
      if (languages.second) targets.add(foldName(languages.second))
    } else if (
      name.includes('yabancı dil') ||
      name.includes('1. yabancı') ||
      name.includes('birinci yabancı')
    ) {
      if (languages.first) targets.add(foldName(languages.first))
    }
  }
  return [...targets]
}

export function teacherMatchesLesson(
  teacher: Teacher,
  subjectName: string,
  languages?: SchoolLanguages | null,
): boolean {
  const branch = foldName(teacherTitleParts(teacher).brans || '')
  if (branch.length < 2) return false
  return lessonBranchTargets(subjectName, languages).some(
    (target) => target === branch || target.includes(branch) || branch.includes(target),
  )
}

export function teachersForLesson(
  teachers: Teacher[],
  subjectName: string,
  languages?: SchoolLanguages | null,
): Teacher[] {
  const byName = (a: Teacher, b: Teacher) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'tr')
  const matched = teachers.filter((teacher) => teacherMatchesLesson(teacher, subjectName, languages)).sort(byName)
  const rest = teachers.filter((teacher) => !teacherMatchesLesson(teacher, subjectName, languages)).sort(byName)
  return [...matched, ...rest]
}

export function lessonTeacherOptions(
  teachers: Teacher[],
  subjectName: string,
  languages?: SchoolLanguages | null,
) {
  return teachersForLesson(teachers, subjectName, languages).map((teacher) => {
    const branch = teacherTitleParts(teacher).brans
    return {
      value: teacher.id,
      label: `${teacher.first_name} ${teacher.last_name}${branch ? ` — ${branch}` : ''}`,
    }
  })
}

/** Branş adlarını karşılaştırmak için anahtar. */
export function branchKey(name?: string | null): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
}

/**
 * Senkron gruplar tek sayılarak şube ve öğretmen haftalık yükleri. Şube yükünde aynı
 * seçmeli grubundaki dersler paralel işlendiğinden grubun en uzun dersi sayılır.
 */
export function computeLoads(rows: TimetableAssignment[]) {
  const teacher = new Map<number, number>()
  const classroom = new Map<number, number>()
  const tSeen = new Set<string>()
  const cSeen = new Set<string>()
  const electiveMax = new Map<string, number>()
  for (const a of rows) {
    const key = a.sync_group ? `g:${a.sync_group}` : `a:${a.id}`
    for (const id of assignmentTeacherIds(a)) {
      const k = `${id}|${key}`
      if (tSeen.has(k)) continue
      tSeen.add(k)
      teacher.set(id, (teacher.get(id) || 0) + a.weekly_hours)
    }
    if (a.elective_group) {
      const gk = `${a.classroom_id}|${a.elective_group}`
      electiveMax.set(gk, Math.max(electiveMax.get(gk) || 0, a.weekly_hours))
      continue
    }
    const ck = `${a.classroom_id}|${key}`
    if (!cSeen.has(ck)) {
      cSeen.add(ck)
      classroom.set(a.classroom_id, (classroom.get(a.classroom_id) || 0) + a.weekly_hours)
    }
  }
  for (const [gk, hours] of electiveMax.entries()) {
    const cid = Number(gk.split('|')[0])
    classroom.set(cid, (classroom.get(cid) || 0) + hours)
  }
  return { teacher, classroom }
}
