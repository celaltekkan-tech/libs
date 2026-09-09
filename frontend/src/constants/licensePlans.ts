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

export interface LicensePlanDefinition {
  name: string
  summary: string
  features: string[]
  modules: LicenseModule[]
  /** users modülü kota; null = sınırsız, 0 veya yok = planda yok */
  userLimit?: number | null
}

// Backend'deki src/config/licensePlans.js ile modül içeriği senkron tutulmalıdır.
export const LICENSE_PLANS: LicensePlanDefinition[] = [
  {
    name: 'Free',
    summary: 'Tek okul, öğretmen ve öğrenci kayıtlarını tutmak için temel plan.',
    features: ['1 okul', 'Öğretmen kayıtları', 'Sınıf/şube tanımları', 'Öğrenci kayıtları', 'Topluluk desteği'],
    modules: ['teachers', 'students', 'classrooms'],
    userLimit: 0,
  },
  {
    name: 'Standart',
    summary: 'Çoklu okul yönetimi ile büyüyen okullar için.',
    features: [
      'Sınırsız öğretmen kaydı',
      'Öğrenci işleri',
      'Sınıf/şube yönetimi',
      'Çoklu okul yönetimi',
      'Kullanıcı ve yetki yönetimi (2 hesap)',
      'Denetim kayıtları',
      'Ders dağıtım ve haftalık ders programı',
      'Personel izin takibi',
      'Dönüşümlü nöbet, ek ders ve puantaj',
      'Devamsızlık/DYK takibi ve veli iletişimi',
      'E-posta desteği',
    ],
    modules: [
      'schools', 'teachers', 'students', 'classrooms', 'users', 'audit', 'schedule', 'leaves',
      'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
    ],
    userLimit: 2,
  },
  {
    name: 'Premium',
    summary: 'Standart paketin tüm özellikleri, sınırsız kullanıcı ve yetki yönetimiyle.',
    features: ['Standart paketin tümü', 'Kullanıcı ve yetki yönetimi (sınırsız)', 'Denetim kayıtları', 'Öncelikli destek'],
    modules: [
      'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
      'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
    ],
    userLimit: null,
  },
  {
    name: 'Kurumsal',
    summary: 'Çok okullu kurumlar için özel entegrasyon ve garantili hizmet seviyesi.',
    features: [
      'Premium paketin tümü',
      'Kullanıcı ve yetki yönetimi (sınırsız)',
      'Denetim kayıtları',
      'Özel entegrasyonlar',
      'SLA garantisi',
      'Özel hesap yöneticisi',
    ],
    modules: [
      'schools', 'teachers', 'users', 'students', 'classrooms', 'audit', 'schedule', 'leaves',
      'duty', 'payroll', 'attendance', 'communications', 'exams', 'discipline', 'guidance',
    ],
    userLimit: null,
  },
]

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
  attendance: 'Devamsızlık / DYK',
  communications: 'Veli İletişim',
  exams: 'Sınav Programı',
  discipline: 'Disiplin',
  guidance: 'Rehberlik',
}

export function getLicensePlan(name: string): LicensePlanDefinition | undefined {
  return LICENSE_PLANS.find((plan) => plan.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))
}
