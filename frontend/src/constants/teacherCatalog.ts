export const UNVAN_OPTIONS = [
  'Müdür',
  'Müdür Başyardımcısı',
  'Müdür Yardımcısı',
  'Müdür Yetkili Öğretmen',
  'Öğretmen',
  'Rehber Öğretmen',
].map((value) => ({ value, label: value }))

const BRANCH_NAMES = [
  'Adalet',
  'Almanca',
  'Arapça',
  'Beden Eğitimi',
  'Bilişim Teknolojileri',
  'Biyoloji',
  'Coğrafya',
  'Çocuk Gelişimi ve Eğitimi',
  'Din Kültürü ve Ahlak Bilgisi',
  'El Sanatları Teknolojisi',
  'Elektrik-Elektronik Teknolojisi',
  'Felsefe',
  'Fen Bilimleri',
  'Fizik',
  'Fransızca',
  'Gıda Teknolojisi',
  'Görsel Sanatlar',
  'Grafik ve Fotoğraf',
  'Güzellik ve Saç Bakım Hizmetleri',
  'Hasta ve Yaşlı Hizmetleri',
  'İngilizce',
  'İnşaat Teknolojisi',
  'Kimya',
  'Kimya Teknolojisi',
  'Makine Teknolojisi',
  'Matematik',
  'Metal Teknolojisi',
  'Mobilya ve İç Mekan Tasarımı',
  'Motorlu Araçlar Teknolojisi',
  'Muhasebe ve Finansman',
  'Müzik',
  'Okul Öncesi',
  'Özel Eğitim',
  'Pazarlama ve Perakende',
  'Rehberlik',
  'Rusça',
  'Sağlık Hizmetleri',
  'Sınıf Öğretmenliği',
  'Sosyal Bilgiler',
  'Tarım',
  'Tarih',
  'Teknoloji ve Tasarım',
  'Tesisat Teknolojisi ve İklimlendirme',
  'Türk Dili ve Edebiyatı',
  'Türkçe',
  'Ulaştırma Hizmetleri',
  'Yiyecek İçecek Hizmetleri',
]

export const BRANCH_OPTIONS = [...BRANCH_NAMES]
  .sort((a, b) => a.localeCompare(b, 'tr'))
  .map((value) => ({ value, label: value }))

export function optionsWithCurrent(
  options: { value: string; label: string }[],
  current?: string | null,
) {
  const value = String(current || '').trim()
  if (!value) return options
  const known = options.some(
    (option) => option.value.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'),
  )
  if (known) return options
  return [{ value, label: value }, ...options]
}
