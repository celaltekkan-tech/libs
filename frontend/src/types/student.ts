export type RegistrationStatus = 'aktif' | 'nakil_gelen' | 'nakil_giden' | 'kayit_silindi'
export type StudentGender = 'K' | 'E'

export interface StudentExtraContact {
  label?: string | null
  phone?: string | null
  address?: string | null
  description?: string | null
}

export interface Student {
  id: number
  tenant_id: number
  school_id: number | null
  classroom_id: number | null
  student_number: string | null
  national_id: string | null
  first_name: string
  last_name: string
  class_level: string | null
  section: string | null
  gender: StudentGender | null
  birth_date: string | null
  registration_status: RegistrationStatus | null
  parent_name: string | null
  parent_phone: string | null
  extra_contacts: StudentExtraContact[]
  is_inclusion: boolean
  is_foreign: boolean
  created_at: string
  updated_at: string
}

export interface StudentPayload {
  school_id?: number | null
  classroom_id: number
  student_number: string
  national_id?: string | null
  first_name: string
  last_name: string
  gender?: StudentGender | null
  birth_date?: string | null
  registration_status?: RegistrationStatus | null
  parent_name?: string | null
  parent_phone?: string | null
  extra_contacts?: StudentExtraContact[]
  is_inclusion?: boolean
  is_foreign?: boolean
}

export interface StudentFilters {
  q?: string
  school_id?: number
  classroom_id?: number
  class_level?: string
  section?: string
  gender?: StudentGender
  registration_status?: RegistrationStatus
}

export interface StudentImportResult {
  created: number
  updated: number
  errors: Array<{ row: number; message: string }>
}

export interface StudentImportField {
  key: string
  label: string
  required: boolean
}

export interface StudentImportPreview {
  sheet_names: string[]
  sheet_name: string
  header_row: number
  headers: Array<{ index: number; label: string }>
  suggested_mapping: Record<string, string>
  detected_class: { class_level: string; section: string; source_text?: string } | null
  sample_rows: Array<{ row: number; values: Record<string, string | null> }>
  importable_fields: StudentImportField[]
  total_rows: number
}

export const STUDENT_IMPORT_FIELD_OPTIONS = [
  { value: 'student_number', label: 'Öğrenci No' },
  { value: 'national_id', label: 'T.C. Kimlik No' },
  { value: 'first_name', label: 'Ad' },
  { value: 'last_name', label: 'Soyad' },
  { value: 'class_level', label: 'Sınıf' },
  { value: 'section', label: 'Şube' },
  { value: 'gender', label: 'Cinsiyet' },
  { value: 'birth_date', label: 'Doğum Tarihi' },
  { value: 'registration_status', label: 'Kayıt Durumu' },
  { value: 'parent_name', label: 'Veli Adı' },
  { value: 'parent_phone', label: 'Veli Telefon' },
  { value: 'is_inclusion', label: 'Kaynaştırma' },
  { value: 'is_foreign', label: 'Yabancı Uyruklu' },
] as const

export const STUDENT_COLUMN_OPTIONS = [
  { value: 'student_number', label: 'Öğrenci No' },
  { value: 'national_id', label: 'T.C. Kimlik No' },
  { value: 'first_name', label: 'Ad' },
  { value: 'last_name', label: 'Soyad' },
  { value: 'class_level', label: 'Sınıf' },
  { value: 'section', label: 'Şube' },
  { value: 'gender', label: 'Cinsiyet' },
  { value: 'birth_date', label: 'Doğum Tarihi' },
  { value: 'registration_status', label: 'Kayıt Durumu' },
  { value: 'parent_name', label: 'Veli Adı' },
  { value: 'parent_phone', label: 'Veli Telefon' },
  { value: 'extra_contacts', label: 'Ek İletişim' },
  { value: 'is_inclusion', label: 'Kaynaştırma' },
  { value: 'is_foreign', label: 'Yabancı Uyruklu' },
] as const

export const REGISTRATION_STATUS_OPTIONS: Array<{ value: RegistrationStatus; label: string }> = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nakil_gelen', label: 'Nakil gelen' },
  { value: 'nakil_giden', label: 'Nakil giden' },
  { value: 'kayit_silindi', label: 'Kayıt silindi' },
]
