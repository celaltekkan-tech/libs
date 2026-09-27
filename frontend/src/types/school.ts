export type SchoolType = 'ilkokul' | 'ortaokul' | 'lise'

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
}

/** Okulun uyguladığı MEB programı; ders havuzu (haftalık ders çizelgesi) buna göre seçilir. */
export type SchoolProgramType =
  | 'ilkokul'
  | 'ortaokul'
  | 'imam_hatip_ortaokulu'
  | 'anadolu_lisesi'
  | 'fen_lisesi'
  | 'sosyal_bilimler_lisesi'
  | 'anadolu_imam_hatip_lisesi'
  | 'spor_lisesi'
  | 'guzel_sanatlar_lisesi'
  | 'mesleki_teknik_anadolu_lisesi'

interface SchoolProgramDef {
  school_type: SchoolType
  label: string
  /** Hazırlık sınıfı bulunan çizelgesi var */
  prep?: boolean
  /** Özel program / tematik program çizelgesi var */
  special?: boolean
  specialLabel?: string
}

// Backend karşılığı: src/utils/schoolProgram.js
export const SCHOOL_PROGRAMS: Record<SchoolProgramType, SchoolProgramDef> = {
  ilkokul: { school_type: 'ilkokul', label: 'İlkokul' },
  ortaokul: { school_type: 'ortaokul', label: 'Ortaokul' },
  imam_hatip_ortaokulu: { school_type: 'ortaokul', label: 'İmam Hatip Ortaokulu' },
  anadolu_lisesi: { school_type: 'lise', label: 'Anadolu Lisesi', prep: true, special: true },
  fen_lisesi: { school_type: 'lise', label: 'Fen Lisesi', prep: true, special: true },
  sosyal_bilimler_lisesi: { school_type: 'lise', label: 'Sosyal Bilimler Lisesi', prep: true, special: true },
  anadolu_imam_hatip_lisesi: { school_type: 'lise', label: 'Anadolu İmam Hatip Lisesi', prep: true },
  spor_lisesi: { school_type: 'lise', label: 'Spor Lisesi', special: true, specialLabel: 'Tematik program uygular' },
  guzel_sanatlar_lisesi: { school_type: 'lise', label: 'Güzel Sanatlar Lisesi' },
  mesleki_teknik_anadolu_lisesi: { school_type: 'lise', label: 'Mesleki ve Teknik Anadolu Lisesi' },
}

export function programOptionsFor(schoolType?: SchoolType) {
  return (Object.keys(SCHOOL_PROGRAMS) as SchoolProgramType[])
    .filter((key) => !schoolType || SCHOOL_PROGRAMS[key].school_type === schoolType)
    .map((key) => ({ value: key, label: SCHOOL_PROGRAMS[key].label }))
}

/** Okul adından program tahmini (katalogdan seçimde ön doldurma için). */
export function guessProgramType(name: string | undefined, schoolType: SchoolType | undefined): SchoolProgramType | undefined {
  const n = (name || '').toLocaleLowerCase('tr-TR')
  if (schoolType === 'ilkokul') return 'ilkokul'
  if (schoolType === 'ortaokul') return n.includes('imam hatip') ? 'imam_hatip_ortaokulu' : 'ortaokul'
  if (schoolType !== 'lise') return undefined
  if (n.includes('imam hatip')) return 'anadolu_imam_hatip_lisesi'
  if (n.includes('sosyal bilimler')) return 'sosyal_bilimler_lisesi'
  if (n.includes('fen lisesi')) return 'fen_lisesi'
  if (n.includes('spor lisesi')) return 'spor_lisesi'
  if (n.includes('güzel sanatlar')) return 'guzel_sanatlar_lisesi'
  if (n.includes('mesleki') || n.includes('teknik')) return 'mesleki_teknik_anadolu_lisesi'
  if (n.includes('anadolu lisesi')) return 'anadolu_lisesi'
  return undefined
}

export const FOREIGN_LANGUAGE_OPTIONS = [
  'İngilizce',
  'Almanca',
  'Rusça',
  'Çince',
  'Fransızca',
  'İspanyolca',
  'Portekizce',
  'Arapça',
  'Farsça',
] as const

export interface SchoolMeta {
  first_foreign_language?: string | null
  second_foreign_language?: string | null
}

export interface School {
  id: number
  tenant_id: number
  name: string
  code: string
  school_type: SchoolType
  program_type?: SchoolProgramType | null
  has_prep_class?: boolean
  is_special_program?: boolean
  daily_period_count: number
  province_id?: number | null
  district_id?: number | null
  directory_school_id?: number | null
  logo_url?: string | null
  meta?: SchoolMeta | null
  Province?: { id: number; name: string } | null
  District?: { id: number; name: string } | null
  created_at: string
  updated_at: string
}

export const SCHOOL_CODE_PATTERN = /^\d{6}$/
export const SCHOOL_CODE_MESSAGE = 'Okul kodu 6 haneli sayı olmalıdır'
export const SCHOOL_CODE_RULES = [
  { required: true, message: 'Okul kodu zorunludur' },
  { pattern: SCHOOL_CODE_PATTERN, message: SCHOOL_CODE_MESSAGE },
]

export interface SchoolPayload {
  name: string
  code?: string
  school_type: SchoolType
  program_type?: SchoolProgramType | null
  has_prep_class?: boolean
  is_special_program?: boolean
  daily_period_count?: number
  province_id?: number | null
  district_id?: number | null
  directory_school_id?: number | null
  meta?: SchoolMeta | null
}
