import client from './client'
import type {
  RegistrationStatus,
  Student,
  StudentFilters,
  StudentImportResult,
  StudentPayload,
  StudentImportPreview,
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
  if (filters.yasi != null) params.yasi = filters.yasi
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

export async function bulkRegistrationStatus(
  updates: Array<{ id: number; registration_status: Exclude<RegistrationStatus, 'aktif'> }>,
): Promise<{ updated: number }> {
  const { data } = await client.post<Envelope<{ updated: number }>>('/api/students/registration-statuses', {
    updates,
  })
  return data.data
}

export async function deleteStudent(id: number): Promise<void> {
  await client.delete(`/api/students/${id}`)
}

export async function previewStudentImport(
  file: File,
  options?: { headerRow?: number | null },
): Promise<StudentImportPreview> {
  const form = new FormData()
  form.append('file', file)
  if (options?.headerRow != null) form.append('header_row', String(options.headerRow))
  const { data } = await client.post<Envelope<StudentImportPreview>>(
    '/api/students/import/preview',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    },
  )
  return data.data
}

export async function importStudents(
  file: File,
  options?: {
    schoolId?: number | null
    classroomId?: number | null
    headerRow?: number | null
    columnMapping?: Record<string, string>
    columnSuggestions?: Record<string, string>
    classLevel?: string | null
    section?: string | null
  },
): Promise<StudentImportResult> {
  const form = new FormData()
  form.append('file', file)
  if (options?.schoolId != null) form.append('school_id', String(options.schoolId))
  if (options?.classroomId != null) form.append('classroom_id', String(options.classroomId))
  if (options?.headerRow != null) form.append('header_row', String(options.headerRow))
  if (options?.classLevel) form.append('class_level', options.classLevel)
  if (options?.section) form.append('section', options.section)
  if (options?.columnMapping) {
    form.append('column_mapping', JSON.stringify(options.columnMapping))
  }
  if (options?.columnSuggestions && Object.keys(options.columnSuggestions).length > 0) {
    form.append('column_suggestions', JSON.stringify(options.columnSuggestions))
  }
  const { data } = await client.post<Envelope<StudentImportResult>>('/api/students/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
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

export async function uploadStudentPhoto(id: number, file: File): Promise<{ photo_url: string | null }> {
  const form = new FormData()
  form.append('photo', file)
  const { data } = await client.post<Envelope<{ photo_url: string | null }>>(`/api/students/${id}/photo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data.data
}

export async function fetchStudentPhotoBlob(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/students/${id}/photo`, {
    responseType: 'blob',
    timeout: 30000,
  })
  return data as Blob
}
