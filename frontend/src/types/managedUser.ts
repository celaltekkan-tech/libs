export type SchoolRoleName = 'Müdür' | 'Müdür Yardımcısı' | 'Memur' | 'Öğretmen'

export interface ManagedUserAssignment {
  id: number
  school_id: number
  role_id: number
  school_role: string | null
  school_name: string | null
}

export interface ManagedUser {
  id: number
  tenant_id: number
  school_id: number | null
  full_name: string
  email: string
  role: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
  school_role: SchoolRoleName | string | null
  assigned_school_id: number | null
  assigned_school_name: string | null
  school_assignments: ManagedUserAssignment[]
  School?: { id: number; name: string; code: string } | null
}

export interface ManagedUserPayload {
  school_id: number
  school_role: SchoolRoleName
  full_name: string
  email: string
  password?: string
  is_active?: boolean
}

export interface UserFormOptions {
  school_roles: Array<{ id: number; name: SchoolRoleName | string }>
  schools: Array<{ id: number; name: string; code: string }>
  user_limit: number | null
  user_count: number
  user_remaining: number | null
}

export const SCHOOL_ROLE_OPTIONS: Array<{ value: SchoolRoleName; label: string; description: string }> = [
  { value: 'Müdür', label: 'Müdür', description: 'Tüm modüllerde tam yetki' },
  {
    value: 'Müdür Yardımcısı',
    label: 'Müdür Yardımcısı',
    description: 'Öğretmen, öğrenci, sınıf ve kullanıcı yönetimi',
  },
  { value: 'Memur', label: 'Memur', description: 'Kayıt oluşturma/güncelleme, silme yok' },
  { value: 'Öğretmen', label: 'Öğretmen', description: 'Salt okuma yetkisi' },
]
