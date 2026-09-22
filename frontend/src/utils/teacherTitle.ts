import type { Teacher } from '../types/teacher'

export const KARIYER_OPTIONS = [
  { value: 'Öğretmen', label: 'Öğretmen' },
  { value: 'Uzman Öğretmen', label: 'Uzman Öğretmen' },
  { value: 'Başöğretmen', label: 'Başöğretmen' },
]

export function normalizeKariyerLabel(value?: string | null) {
  const folded = (value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '')
  if (folded.includes('basogretmen')) return 'Başöğretmen'
  if (folded.includes('uzman')) return 'Uzman Öğretmen'
  return 'Öğretmen'
}

export function teacherTitleParts(teacher: Teacher) {
  if (teacher.unvan || teacher.brans || teacher.kariyer) {
    return {
      unvan: teacher.unvan,
      brans: teacher.brans,
      kariyer: teacher.kariyer || 'Öğretmen',
    }
  }
  const raw = teacher.title_branch || ''
  const paren = /\s*\(([^)]+)\)\s*$/.exec(raw)
  const hint = paren?.[1]?.trim() || null
  const base = paren ? raw.slice(0, paren.index).trim() : raw
  const idx = base.indexOf('/')
  const unvan = (idx >= 0 ? base.slice(0, idx) : base).trim() || null
  const brans = (idx >= 0 ? base.slice(idx + 1) : '').trim() || null
  return { unvan, brans, kariyer: normalizeKariyerLabel(hint) }
}
