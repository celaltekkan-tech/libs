export type RegistrationStatus = 'aktif' | 'nakil_giden' | 'orgun_egitim_disi'
export type StudentGender = 'K' | 'E'
export type BoardingStatus = 'Yatılı' | 'Gündüzlü'

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
  yasi: number | null
  registration_status: RegistrationStatus | null
  parent_name: string | null
  mother_name: string | null
  father_name: string | null
  parent_phone: string | null
  student_phone: string | null
  extra_contacts: StudentExtraContact[]
  is_inclusion: boolean
  is_foreign: boolean
  boarding_status: BoardingStatus | null
  photo_url?: string | null
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
  yasi?: number | null
  registration_status?: RegistrationStatus | null
  parent_name?: string | null
  mother_name?: string | null
  father_name?: string | null
  parent_phone?: string | null
  student_phone?: string | null
  extra_contacts?: StudentExtraContact[]
  is_inclusion?: boolean
  is_foreign?: boolean
  boarding_status?: BoardingStatus | null
}

export interface StudentFilters {
  q?: string
  school_id?: number
  classroom_id?: number
  class_level?: string
  section?: string
  gender?: StudentGender
  yasi?: number
  registration_status?: RegistrationStatus
  boarding_status?: BoardingStatus
}

export interface StudentImportField {
  key: string
  label: string
  required: boolean
}

export interface PhotoRosterImportRow {
  row: number
  student_number: string | null
  full_name: string | null
  matched: boolean
  current_name: string | null
  has_photo: boolean
}

/** Normal, sütun başlıklı Excel dosyaları için içe aktarma önizlemesi/sonucu. */
export interface StudentImportPreviewTable {
  format: 'table'
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

export interface ImportMissingStudent {
  id: number
  first_name: string
  last_name: string
  student_number: string | null
}

export interface ImportMissingClass {
  classroom_id: number
  class_level: string
  section: string
  students: ImportMissingStudent[]
}

export interface StudentImportResultTable {
  format: 'table'
  created: number
  updated: number
  errors: Array<{ row: number; message: string }>
  unmatched_columns?: string[]
  feedback_created?: boolean
  missing_by_class?: ImportMissingClass[]
}

/** E-Okul "Fotoğraflı Öğrenci Bilgileri" dökümü gibi öğrenci başına form/blok
 * halinde basılan dosyalar için içe aktarma önizlemesi/sonucu — yalnızca sistemde
 * numarası/kimliği eşleşen kayıtları günceller, yeni öğrenci oluşturmaz. */
export interface StudentImportPreviewPhotoRoster {
  format: 'photo_roster'
  sheet_name: string
  total_rows: number
  matched: number
  not_found: number
  photos_found: number
  rows: PhotoRosterImportRow[]
}

export interface StudentImportResultPhotoRoster {
  format: 'photo_roster'
  updated: number
  not_found: number
  photos_saved: number
  errors: Array<{ row: number; message: string }>
}

export type StudentImportPreview = StudentImportPreviewTable | StudentImportPreviewPhotoRoster
export type StudentImportResult = StudentImportResultTable | StudentImportResultPhotoRoster

export const STUDENT_IMPORT_FIELD_OPTIONS = [
  { value: 'student_number', label: 'Öğrenci No' },
  { value: 'national_id', label: 'T.C. Kimlik No' },
  { value: 'first_name', label: 'Ad' },
  { value: 'last_name', label: 'Soyad' },
  { value: 'class_level', label: 'Sınıf' },
  { value: 'section', label: 'Şube' },
  { value: 'gender', label: 'Cinsiyet' },
  { value: 'birth_date', label: 'Doğum Tarihi' },
  { value: 'yasi', label: 'Yaşı' },
  { value: 'registration_status', label: 'Kayıt Durumu' },
  { value: 'parent_name', label: 'Veli Adı' },
  { value: 'mother_name', label: 'Anne Adı' },
  { value: 'father_name', label: 'Baba Adı' },
  { value: 'parent_phone', label: 'Veli Telefon' },
  { value: 'student_phone', label: 'Öğrenci Telefon' },
  { value: 'is_inclusion', label: 'Kaynaştırma' },
  { value: 'is_foreign', label: 'Yabancı Uyruklu' },
  { value: 'boarding_status', label: 'Yurt Durumu' },
] as const

export const STUDENT_COLUMN_OPTIONS = [
  { value: 'student_number', label: 'Öğrenci No' },
  { value: 'national_id', label: 'T.C. Kimlik No' },
  { value: 'first_name', label: 'Ad' },
  { value: 'last_name', label: 'Soyad' },
  { value: 'full_name', label: 'Ad Soyad (birleşik)' },
  { value: 'school_name', label: 'Okul' },
  { value: 'class_level', label: 'Sınıf' },
  { value: 'section', label: 'Şube' },
  { value: 'gender', label: 'Cinsiyet' },
  { value: 'birth_date', label: 'Doğum Tarihi' },
  { value: 'yasi', label: 'Yaşı' },
  { value: 'registration_status', label: 'Kayıt Durumu' },
  { value: 'parent_name', label: 'Veli Adı' },
  { value: 'mother_name', label: 'Anne Adı' },
  { value: 'father_name', label: 'Baba Adı' },
  { value: 'parent_phone', label: 'Veli Telefon' },
  { value: 'student_phone', label: 'Öğrenci Telefon' },
  { value: 'extra_contacts', label: 'Ek İletişim' },
  { value: 'is_inclusion', label: 'Kaynaştırma' },
  { value: 'is_foreign', label: 'Yabancı Uyruklu' },
  { value: 'boarding_status', label: 'Yurt Durumu' },
] as const

export const BOARDING_STATUS_OPTIONS: Array<{ value: BoardingStatus; label: string }> = [
  { value: 'Yatılı', label: 'Yatılı' },
  { value: 'Gündüzlü', label: 'Gündüzlü' },
]

export const REGISTRATION_STATUS_OPTIONS: Array<{ value: RegistrationStatus; label: string }> = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'nakil_giden', label: 'Nakil giden' },
  { value: 'orgun_egitim_disi', label: 'Örgün eğitim dışı' },
]
