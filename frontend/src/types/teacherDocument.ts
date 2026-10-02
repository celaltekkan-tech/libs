export const DOC_CATEGORY_OPTIONS = [
  { value: 'mevzuat', label: 'Mevzuat' },
  { value: 'yillik_evrak', label: 'Yıllık evraklar' },
  { value: 'dilekce', label: 'Dilekçe örnekleri' },
  { value: 'sinif_rehberlik', label: 'Sınıf rehberlik evrakları' },
  { value: 'maarif', label: 'Maarif modeli evrak örnekleri' },
] as const

export type DocCategory = (typeof DOC_CATEGORY_OPTIONS)[number]['value']

export const DOC_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOC_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
)

export const DMK_657_URL =
  'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=657&MevzuatTur=1&MevzuatTertip=5'

export const EK_DERS_YONETMELIGI_SLUG = 'ek-ders-yonetmeligi'
export const EK_DERS_YONETMELIGI_FILENAME = 'Ek-Ders-Yonetmeligi.pdf'
export const AYAKTA_TEDAVI_SLUG = 'ayakta-tedavi-beyan-belgesi'
export const AYAKTA_TEDAVI_FILENAME = 'Ayakta-Tedavi-Beyan-Belgesi.docx'

export const DOC_TYPE_OPTIONS = [
  { value: 'yillik_plan', label: 'Yıllık Plan' },
  { value: 'zumre_tutanagi', label: 'Zümre Tutanağı' },
  { value: 'sinif_rehberlik_plani', label: 'Sınıf Rehberlik Planı' },
  { value: 'kulup_raporu', label: 'Kulüp / Toplum Hizmeti Raporu' },
  { value: 'maarif_modeli_raporu', label: 'Maarif Modeli Etkinlik Raporu' },
  { value: 'ogrenci_gelisim_raporu', label: 'Öğrenci Gelişim Raporu' },
  { value: 'diger', label: 'Diğer' },
]

export const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(DOC_TYPE_OPTIONS.map((o) => [o.value, o.label]))

export const DOC_STATUS_OPTIONS = [
  { value: 'taslak', label: 'Taslak' },
  { value: 'teslim_edildi', label: 'Teslim Edildi' },
  { value: 'onaylandi', label: 'Onaylandı' },
  { value: 'revizyon_istendi', label: 'Revizyon İstendi' },
]

export const DOC_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DOC_STATUS_OPTIONS.map((o) => [o.value, o.label]),
)

export interface TeacherDocument {
  id: number
  tenant_id: number
  teacher_id: number | null
  category?: string | null
  doc_type: string
  title: string
  academic_year: string | null
  content: string | null
  status: string
  reviewer_note: string | null
  Teacher?: { id: number; first_name: string; last_name: string; personnel_no: string | null } | null
  created_at: string
  updated_at: string
}

export interface TeacherDocumentPayload {
  teacher_id?: number | null
  category: string
  doc_type?: string
  title: string
  academic_year?: string | null
  content?: string | null
}
