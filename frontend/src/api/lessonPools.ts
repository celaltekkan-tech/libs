import client from './client'

interface Envelope<T> {
  success: true
  data: T
}

export type LessonPoolKind = 'ortak' | 'secmeli' | 'rehberlik'
export type SchoolTypeValue = 'ilkokul' | 'ortaokul' | 'lise'

export interface LessonPoolItem {
  sort_order?: number
  name: string
  kind: LessonPoolKind
  category: string | null
  max_takes: number | null
  has_options?: boolean
  // seviye -> saat seçenekleri ("(3)(5)" -> [3, 5])
  hours: Record<string, number[]>
}

export interface ParsedSheet {
  title: string
  source: string
  levels: string[]
  items: LessonPoolItem[]
  warnings: string[]
}

export interface LessonPoolTemplateSummary {
  id: number
  name: string
  school_type: SchoolTypeValue | null
  levels: string[]
  source_name: string | null
  note: string | null
  is_active: boolean
  item_count: number
  elective_count: number
  updated_at: string
}

export interface LessonPoolTemplate {
  id: number
  name: string
  school_type: SchoolTypeValue | null
  levels: string[]
  items: LessonPoolItem[]
  source_name: string | null
  note: string | null
  is_active: boolean
}

export type LessonPoolTemplatePayload = Omit<LessonPoolTemplate, 'id'>

const BASE = '/api/platform/lesson-pools'

export async function parseLessonPoolFile(file: File): Promise<{ file_name: string; sheets: ParsedSheet[] }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<Envelope<{ file_name: string; sheets: ParsedSheet[] }>>(`${BASE}/parse`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
  return data.data
}

export async function listLessonPoolTemplates(): Promise<LessonPoolTemplateSummary[]> {
  const { data } = await client.get<Envelope<LessonPoolTemplateSummary[]>>(BASE)
  return data.data
}

export async function getLessonPoolTemplate(id: number): Promise<LessonPoolTemplate> {
  const { data } = await client.get<Envelope<LessonPoolTemplate>>(`${BASE}/${id}`)
  return data.data
}

export async function createLessonPoolTemplate(payload: LessonPoolTemplatePayload): Promise<LessonPoolTemplate> {
  const { data } = await client.post<Envelope<LessonPoolTemplate>>(BASE, payload)
  return data.data
}

export async function updateLessonPoolTemplate(
  id: number,
  payload: Partial<LessonPoolTemplatePayload>,
): Promise<LessonPoolTemplate> {
  const { data } = await client.put<Envelope<LessonPoolTemplate>>(`${BASE}/${id}`, payload)
  return data.data
}

export async function deleteLessonPoolTemplate(id: number): Promise<void> {
  await client.delete(`${BASE}/${id}`)
}

// ---- okul tarafı: hazır havuzu ders havuzuna aktarma
export interface AvailablePoolTemplate {
  id: number
  name: string
  school_type: SchoolTypeValue | null
  levels: string[]
  note: string | null
  items: LessonPoolItem[]
  // şablon ders adı -> okuldaki ders önerisi
  matches: Record<string, { subject_id: number; match: 'exact' | 'similar' }>
  matches_school: boolean
}

export async function listAvailablePoolTemplates(projectId: number): Promise<{
  templates: AvailablePoolTemplate[]
  school_type: SchoolTypeValue | null
  class_levels: string[]
  subjects: Array<{ id: number; name: string; is_active: boolean }>
}> {
  const { data } = await client.get<
    Envelope<{
      templates: AvailablePoolTemplate[]
      school_type: SchoolTypeValue | null
      class_levels: string[]
      subjects: Array<{ id: number; name: string; is_active: boolean }>
    }>
  >('/api/timetable/pool-templates', { params: { project_id: projectId } })
  return data.data
}

export interface PoolImportResult {
  subjects_created: number
  subjects_updated: number
  hours_created: number
  hours_removed: number
  skipped: number
}

export async function importPoolTemplate(
  projectId: number,
  payload: {
    template_id: number
    level_map: Record<string, string | null>
    mode: 'merge' | 'replace'
    kinds: LessonPoolKind[]
    // şablon ders adı -> okuldaki ders id (0: yeni ders aç)
    subject_map: Record<string, number>
  },
): Promise<PoolImportResult> {
  const { data } = await client.post<Envelope<PoolImportResult>>(
    `/api/timetable/projects/${projectId}/pool/import-template`,
    payload,
  )
  return data.data
}

export const KIND_LABELS: Record<LessonPoolKind, string> = {
  ortak: 'Ortak',
  secmeli: 'Seçmeli',
  rehberlik: 'Rehberlik',
}

export const SCHOOL_TYPE_LABELS: Record<SchoolTypeValue, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
}

/** [3, 5] -> "3/5" ; "3/5" -> [3, 5] */
export function formatHours(list?: number[]): string {
  return (list || []).join('/')
}

export function parseHoursText(text: string): number[] {
  return [...new Set((text.match(/\d{1,2}/g) || []).map(Number).filter((n) => n > 0 && n <= 40))].sort((a, b) => a - b)
}
