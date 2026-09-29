import client from './client'
import { downloadBlob } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

export interface SkillBusiness {
  id: number
  school_id: number
  name: string
  tax_no: string | null
  sgk_workplace_no: string | null
  address: string | null
  phone: string | null
  field_name: string | null
  master_name: string | null
  contact_name: string | null
  is_active: boolean
}

export interface SkillPerson {
  id: number
  first_name: string
  last_name: string
  student_number?: string | null
  national_id?: string | null
  class_level?: string | null
  section?: string | null
}

export interface SkillPlacement {
  id: number
  student_id: number
  business_id: number
  teacher_id: number | null
  academic_year: string | null
  start_date: string | null
  end_date: string | null
  weekly_days: number
  contract_no: string | null
  contract_date: string | null
  status: 'aktif' | 'tamamlandi' | 'ayrildi'
  note: string | null
  Student?: SkillPerson | null
  Business?: SkillBusiness | null
  Coordinator?: SkillPerson | null
}

export interface SkillSupport {
  id: number
  placement_id: number
  year: number
  month: number
  work_days: number
  amount: string | number | null
  status: 'bekliyor' | 'odendi'
  paid_at: string | null
  note: string | null
  SkillPlacement?: SkillPlacement | null
}

export interface SkillSgk {
  id: number
  placement_id: number
  kind: 'giris' | 'cikis'
  notice_date: string | null
  sgk_ref: string | null
  status: 'taslak' | 'bildirildi'
  note: string | null
  SkillPlacement?: SkillPlacement | null
}

export async function listSkillBusinesses(schoolId: number): Promise<SkillBusiness[]> {
  const { data } = await client.get<Envelope<SkillBusiness[]>>('/api/skill-training/businesses', { params: { school_id: schoolId } })
  return data.data
}

export async function saveSkillBusiness(payload: Partial<SkillBusiness> & { school_id: number; name: string }, id?: number): Promise<SkillBusiness> {
  const { data } = id
    ? await client.put<Envelope<SkillBusiness>>(`/api/skill-training/businesses/${id}`, payload)
    : await client.post<Envelope<SkillBusiness>>('/api/skill-training/businesses', payload)
  return data.data
}

export async function deleteSkillBusiness(id: number): Promise<void> {
  await client.delete(`/api/skill-training/businesses/${id}`)
}

export async function listSkillPlacements(schoolId: number): Promise<SkillPlacement[]> {
  const { data } = await client.get<Envelope<SkillPlacement[]>>('/api/skill-training/placements', { params: { school_id: schoolId } })
  return data.data
}

export async function saveSkillPlacement(payload: Record<string, unknown>, id?: number): Promise<SkillPlacement> {
  const { data } = id
    ? await client.put<Envelope<SkillPlacement>>(`/api/skill-training/placements/${id}`, payload)
    : await client.post<Envelope<SkillPlacement>>('/api/skill-training/placements', payload)
  return data.data
}

export async function deleteSkillPlacement(id: number): Promise<void> {
  await client.delete(`/api/skill-training/placements/${id}`)
}

export async function listSkillSupports(schoolId: number, year: number, month: number): Promise<SkillSupport[]> {
  const { data } = await client.get<Envelope<SkillSupport[]>>('/api/skill-training/supports', {
    params: { school_id: schoolId, year, month },
  })
  return data.data
}

export async function generateSkillSupports(schoolId: number, year: number, month: number): Promise<number> {
  const { data } = await client.post<Envelope<{ created: number }>>('/api/skill-training/supports/generate', {
    school_id: schoolId,
    year,
    month,
  })
  return data.data.created
}

export async function updateSkillSupport(id: number, payload: Partial<SkillSupport>): Promise<void> {
  await client.put(`/api/skill-training/supports/${id}`, payload)
}

export async function listSkillSgk(schoolId: number): Promise<SkillSgk[]> {
  const { data } = await client.get<Envelope<SkillSgk[]>>('/api/skill-training/sgk', { params: { school_id: schoolId } })
  return data.data
}

export async function prepareSkillSgk(schoolId: number): Promise<number> {
  const { data } = await client.post<Envelope<{ created: number }>>('/api/skill-training/sgk/prepare', { school_id: schoolId })
  return data.data.created
}

export async function updateSkillSgk(id: number, payload: Partial<SkillSgk>): Promise<void> {
  await client.put(`/api/skill-training/sgk/${id}`, payload)
}

export async function downloadSkillDocument(params: {
  school_id: number
  kind: 'sozlesme' | 'devam' | 'destek' | 'sgk'
  placement_id?: number
  year?: number
  month?: number
  filename: string
}): Promise<void> {
  const { filename, ...query } = params
  const { data } = await client.get('/api/skill-training/documents', { params: query, responseType: 'blob' })
  downloadBlob(data, filename)
}
