export type LicenseModule =
  | 'schools'
  | 'teachers'
  | 'users'
  | 'students'
  | 'classrooms'
  | 'audit'
  | 'schedule'
  | 'leaves'
  | 'duty'
  | 'payroll'
  | 'attendance'
  | 'communications'
  | 'exams'
  | 'discipline'
  | 'guidance'

export type LicensePlanKind = 'main' | 'addon'
export type AddonCategory = 'sms' | 'ai'

export interface LicensePlanDefinition {
  name: string
  summary: string
  features: string[]
  modules: LicenseModule[]
  kind?: LicensePlanKind
  /** Eklenti kategorisi; yeni eklenti yalnızca aynı kategorideki öncekini değiştirir */
  category?: AddonCategory
  /** users modülü kota; null = sınırsız, 0 veya yok = planda yok */
  userLimit?: number | null
  /** okul kotası; null = sınırsız */
  schoolLimit?: number | null
  /** SMS eklentisi: lisans süresi boyunca başarılı SMS kotası; null = sınırsız */
  smsQuota?: number | null
}

// Backend'deki src/config/licensePlans.js ile modül içeriği senkron tutulmalıdır.
export const LICENSE_PLANS: LicensePlanDefinition[] = [
  {
    name: 'Basic',
    summary: 'Tek okul, öğretmen ve öğrenci kayıtlarını tutmak için temel plan.',
    features: ['1 okul', 'Öğretmen kayıtları', 'Sınıf/şube tanımları', 'Öğrenci kayıtları', 'Topluluk desteği'],
    modules: ['teachers', 'students', 'classrooms'],
    userLimit: 0,
    schoolLimit: 1,
  },
  {
    name: 'Standart',
    summary: 'Tek okul yönetimi ile günlük idari işlemler için.',
    features: [
      '1 okul',
      'Sınırsız öğretmen kaydı',
      'Öğrenci işleri',
      'Sınıf/şube yönetimi',
      'Kullanıcı ve yetki yönetimi (öğretmen ve rehber öğretmen hariç 2 hesap)',
      'Denetim kayıtları',
      'Ders dağıtım ve haftalık ders programı',
      'Personel izin takibi',
      'Dönüşümlü nöbet, ek ders ve puantaj',
      'DYK / öğrenci devamsızlık takibi ve veli iletişimi',
      'Öğretmen mobil uygulaması (öğrenci arama ve disiplin bildirimi)',
      'E-posta desteği',
    ],
    modules: [
      'schools', 'teachers', 'students', 'classrooms', 'users', 'audit', 'schedule', 'leaves',
      'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
    ],
    userLimit: 2,
    schoolLimit: 1,
  },
  {
    name: 'Premium',
    summary: 'Standart paketin tüm özellikleri, en fazla 3 okul ve sınırsız kullanıcı yönetimiyle.',
    features: ['Standart paketin tümü', 'En fazla 3 okul', 'Kullanıcı ve yetki yönetimi (sınırsız)', 'Denetim kayıtları', 'Öncelikli destek'],
    modules: [
      'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
      'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
    ],
    userLimit: null,
    schoolLimit: 3,
  },
]

export const ADDON_LICENSE_PLANS: LicensePlanDefinition[] = [
  {
    name: 'SMS 3000',
    kind: 'addon',
    summary: 'Ana lisansa ek SMS kullanım lisansı. 3.000 başarılı SMS kotası.',
    features: [
      'Ana lisansı iptal etmez; yanına eklenir',
      '3.000 başarılı SMS (lisans süresi boyunca)',
      'Lisans bitiminde veya yenilemede kullanılmayan krediler sıfırlanır',
      'Veli duyurusu, görev hatırlatması ve SMS ile giriş bu kotadan düşer',
      'Öğretmen kayıt doğrulama SMS’i kotaya dahil değildir ve lisans gerektirmez',
      'Kota dolunca SMS gönderimi durur',
    ],
    modules: [],
    category: 'sms',
    smsQuota: 3000,
  },
  {
    name: 'SMS 10000',
    kind: 'addon',
    summary: 'Ana lisansa ek SMS kullanım lisansı. 10.000 başarılı SMS kotası.',
    features: [
      'Ana lisansı iptal etmez; yanına eklenir',
      '10.000 başarılı SMS (lisans süresi boyunca)',
      'Lisans bitiminde veya yenilemede kullanılmayan krediler sıfırlanır',
      'Veli duyurusu, görev hatırlatması ve SMS ile giriş bu kotadan düşer',
      'Öğretmen kayıt doğrulama SMS’i kotaya dahil değildir ve lisans gerektirmez',
      'Kota dolunca SMS gönderimi durur',
    ],
    modules: [],
    category: 'sms',
    smsQuota: 10000,
  },
  {
    name: 'Yapay Zekâ',
    kind: 'addon',
    category: 'ai',
    summary: 'Ana lisansa ek yapay zekâ özellikleri.',
    features: [
      'Ana lisansı ve SMS eklentisini iptal etmez; yanına eklenir',
      'Otomatik ders programında istekleri Türkçe yazıp kısıta çevirme',
      'Önerilen kısıtlar kullanıcı onayı olmadan eklenmez',
      'Kiracı başına günlük istek sınırı uygulanır',
    ],
    modules: [],
  },
]

export const ALL_LICENSE_PLANS: LicensePlanDefinition[] = [...LICENSE_PLANS, ...ADDON_LICENSE_PLANS]

// Kurumsal katalogda yok; mevcut lisanslar için okul kodu atama hakkı korunur.
const SCHOOL_CODE_ASSIGN_PLANS = new Set(['premium', 'kurumsal'])

export const MODULE_LABELS: Record<LicenseModule, string> = {
  schools: 'Okullar',
  teachers: 'Öğretmenler',
  users: 'Yetkilendirme',
  students: 'Öğrenciler',
  classrooms: 'Sınıflar',
  audit: 'Denetim Kayıtları',
  schedule: 'Ders Programı',
  leaves: 'İzin Takibi',
  duty: 'Nöbet Programı',
  payroll: 'Ek Ders / Puantaj',
  attendance: 'DYK Devamsızlık Takibi',
  communications: 'Veli İletişim',
  exams: 'Sınav Programı Hazırlama',
  discipline: 'Disiplin',
  guidance: 'Rehberlik',
}

export function getLicensePlan(name: string): LicensePlanDefinition | undefined {
  const normalized = name.toLocaleLowerCase('tr-TR') === 'free' ? 'basic' : name.toLocaleLowerCase('tr-TR')
  if (normalized === 'sms') {
    return ADDON_LICENSE_PLANS.find((plan) => plan.name === 'SMS 3000')
  }
  if (normalized === 'ai' || normalized === 'yapay zeka') {
    return ADDON_LICENSE_PLANS.find((plan) => plan.category === 'ai')
  }
  return ALL_LICENSE_PLANS.find((plan) => plan.name.toLocaleLowerCase('tr-TR') === normalized)
}

export function isAddonPlan(planName?: string | null): boolean {
  if (!planName) return false
  const def = getLicensePlan(planName)
  return def?.kind === 'addon'
}

export function isSmsPlan(planName?: string | null): boolean {
  if (!planName) return false
  return getLicensePlan(planName)?.category === 'sms'
}

export function isAiPlan(planName?: string | null): boolean {
  if (!planName) return false
  return getLicensePlan(planName)?.category === 'ai'
}

/** Premium (ve varsa mevcut Kurumsal) kiracı okul kodunu kendisi belirler. */
export function canAssignSchoolCode(planName?: string | null): boolean {
  if (!planName) return false
  return SCHOOL_CODE_ASSIGN_PLANS.has(planName.toLocaleLowerCase('tr-TR'))
}
