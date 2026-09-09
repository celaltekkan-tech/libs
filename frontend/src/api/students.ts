import client from './client'
import type {
  Student,
  StudentFilters,
  StudentImportResult,
  StudentPayload,
} from '../types/student'
import type { ExportFormat } from '../utils/download'

interface Envelope<T> {
  success: true
  data: T
}

function toParams(filters?: StudentFilters): Record<string, string | number> | undefined {
  if (!filters) return undefined
  const params: Record<string, string | number> = {}
  if (filters.school_id != null) params.school_id = filters.school_id
  if (filters.classroom_id != null) params.classroom_id = filters.classroom_id
  if (filters.class_level) params.class_level = filters.class_level
  if (filters.section) params.section = filters.section
  if (filters.gender) params.gender = filters.gender
  if (filters.registration_status) params.registration_status = filters.registration_status
  return Object.keys(params).length ? params : undefined
}

export async function listStudents(filters?: StudentFilters): Promise<Student[]> {
  const { data } = await client.get<Envelope<Student[]>>('/api/students', {
    params: toParams(filters),
  })
  return data.data
}

export async function createStudent(tenantId: number, payload: StudentPayload): Promise<Student> {
  const { data } = await client.post<Envelope<Student>>('/api/students', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function updateStudent(id: number, payload: Partial<StudentPayload>): Promise<Student> {
  const { data } = await client.put<Envelope<Student>>(`/api/students/${id}`, payload)
  return data.data
}

export async function deleteStudent(id: number): Promise<void> {
  await client.delete(`/api/students/${id}`)
}

export async function importStudents(
  file: File,
  schoolId?: number | null,
): Promise<StudentImportResult> {
  const form = new FormData()
  form.append('file', file)
  if (schoolId != null) form.append('school_id', String(schoolId))
  const { data } = await client.post<Envelope<StudentImportResult>>('/api/students/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data.data
}

export async function exportStudents(payload: {
  format: ExportFormat
  columns: string[]
  filters?: StudentFilters
}): Promise<Blob> {
  const { data } = await client.post('/api/students/export', payload, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}

export type StudentCertificateType = 'ogrenci_belgesi' | 'ogrenim_durumu'

export async function downloadStudentCertificate(
  id: number,
  type: StudentCertificateType,
): Promise<Blob> {
  const { data } = await client.get(`/api/students/${id}/certificate`, {
    params: { type },
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
}
