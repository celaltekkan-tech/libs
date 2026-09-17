export interface PageHelpTopic {
  title: string
  body?: string
  steps?: string[]
}

export interface PageHelpContent {
  title: string
  summary: string
  topics: PageHelpTopic[]
}

const DEFAULT_HELP: PageHelpContent = {
  title: 'Sayfa yardımı',
  summary: 'Bu sayfada kayıtları görüntüleyebilir, yetkiniz varsa ekleyebilir, düzenleyebilir veya silebilirsiniz.',
  topics: [
    {
      title: 'Genel kullanım',
      steps: [
        'Üst menüden ilgili modüle geçin.',
        'Liste ve filtrelerle kayıtları bulun.',
        'Yetkiniz varsa Yeni / Düzenle / Sil butonlarını kullanın.',
      ],
    },
  ],
}

const PAGE_HELP: Record<string, PageHelpContent> = {
  '/': {
    title: 'Ana Sayfa',
    summary: 'Kurumunuza ait özet kartlar, yaklaşan işler ve hızlı erişim alanı.',
    topics: [
      {
        title: 'Özet kartlar',
        body: 'Okul, öğretmen, öğrenci ve yaklaşan iş sayılarını gösterir. Karta tıklayarak ilgili sayfaya gidebilirsiniz.',
      },
      {
        title: 'Yaklaşan işler',
        steps: [
          'Önümüzdeki günlerde vadesi gelen veya gecikmiş görevler listelenir.',
          'Atandığınız görevlerde Yapıldı ile tamamlayabilirsiniz.',
          'Tümü bağlantısıyla İş Takibi sayfasına gidin.',
        ],
      },
      {
        title: 'Düzeni değiştirme',
        body: 'Kartları sürükleyerek kendi düzeninizi kaydedebilirsiniz (tarayıcıda saklanır).',
      },
    ],
  },
  '/profile': {
    title: 'Profilim',
    summary: 'Hesap bilgilerinizi, şifrenizi ve iki adımlı doğrulama ayarlarını yönetirsiniz.',
    topics: [
      {
        title: 'Bilgi güncelleme',
        steps: ['Ad soyad veya e-posta alanlarını düzenleyin.', 'Kaydet ile değişiklikleri uygulayın.'],
      },
      {
        title: 'Şifre değiştirme',
        steps: ['Mevcut şifrenizi girin.', 'Yeni şifreyi iki kez yazıp kaydedin.'],
      },
    ],
  },
  '/schools': {
    title: 'Okullar',
    summary: 'Kuruma bağlı okul kayıtlarını ekler, düzenler ve listelersiniz.',
    topics: [
      {
        title: 'Yeni okul',
        steps: ['Yeni Okul butonuna tıklayın.', 'Ad, kod ve diğer alanları doldurun.', 'Kaydet ile kaydı oluşturun.'],
      },
      {
        title: 'Düzenleme / silme',
        body: 'Satırdaki düzenle veya sil işlemleriyle mevcut kaydı güncelleyebilirsiniz (yetkiye bağlı).',
      },
    ],
  },
  '/classrooms': {
    title: 'Sınıflar / Şubeler',
    summary: 'Sınıf ve şube tanımlarını yönetirsiniz; ders programı ve öğrenci atamaları için temel kayıttır.',
    topics: [
      {
        title: 'Sınıf ekleme',
        steps: ['Yeni kayıt oluşturun.', 'Sınıf düzeyi, şube ve kapasite bilgilerini girin.', 'Kaydedin.'],
      },
    ],
  },
  '/students': {
    title: 'Öğrenciler',
    summary: 'Öğrenci kayıtları, sınıf ataması ve kayıt durumu takibi.',
    topics: [
      {
        title: 'Öğrenci ekleme',
        steps: [
          'Yeni Öğrenci ile formu açın.',
          'Kimlik, sınıf ve veli iletişim bilgilerini girin.',
          'Kayıt durumunu seçip kaydedin.',
        ],
      },
      {
        title: 'Arama ve filtre',
        body: 'Ad, numara veya sınıf ile listede arama yapabilirsiniz.',
      },
    ],
  },
  '/teachers': {
    title: 'Öğretmenler',
    summary: 'Öğretmen kadrosunu ekler, branş ve okul bağlantılarını yönetirsiniz.',
    topics: [
      {
        title: 'Öğretmen kaydı',
        steps: ['Yeni Öğretmen butonunu kullanın.', 'Kimlik, branş ve iletişim bilgilerini doldurun.', 'Kaydedin.'],
      },
      {
        title: 'Maaş / belge işlemleri',
        body: 'Yetkiniz varsa satır menüsünden ilgili form veya belge işlemlerine geçebilirsiniz.',
      },
    ],
  },
  '/other-personnel': {
    title: 'Diğer Personeller',
    summary: 'Öğretmen dışı personel (memur, hizmetli vb.) kayıtlarını tutarsınız.',
    topics: [
      {
        title: 'Personel ekleme',
        steps: ['Yeni kayıt oluşturun.', 'Görev / kategori bilgisini seçin.', 'Kaydedin.'],
      },
    ],
  },
  '/subjects': {
    title: 'Dersler',
    summary: 'Ders programında kullanılacak ders tanımlarını yönetirsiniz.',
    topics: [
      {
        title: 'Ders tanımı',
        steps: ['Yeni Ders ekleyin.', 'Ad, kod ve varsa haftalık saat bilgisini girin.', 'Kaydedin.'],
      },
    ],
  },
  '/academic-years': {
    title: 'Eğitim Öğretim Yılları',
    summary: 'Aktif eğitim-öğretim yılını ve dönemleri tanımlarsınız.',
    topics: [
      {
        title: 'Yıl ekleme',
        steps: ['Yeni yıl kaydı oluşturun.', 'Başlangıç / bitiş tarihlerini girin.', 'Aktif yılı işaretleyin.'],
      },
    ],
  },
  '/norm-positions': {
    title: 'Norm Kadro Takibi',
    summary: 'Norm kadro ihtiyaç ve doluluk bilgisini takip eder; form çıktıları alabilirsiniz.',
    topics: [
      {
        title: 'Norm kaydı',
        body: 'Branş / alan bazında norm ve mevcut kadro bilgilerini girin veya güncelleyin.',
      },
      {
        title: 'Çıktı',
        body: 'Yetkiniz varsa Excel / PDF çıktı veya maaş değişikliği formu işlemlerini kullanın.',
      },
    ],
  },
  '/teacher-documents': {
    title: 'Öğretmen Evrak Arşivi',
    summary: 'Öğretmen belgelerini yükler, arşivler ve indirirsiniz.',
    topics: [
      {
        title: 'Belge yükleme',
        steps: ['Öğretmeni seçin.', 'Belge türünü belirleyin.', 'Dosyayı yükleyip kaydedin.'],
      },
    ],
  },
  '/leaves': {
    title: 'Personel İzin Takibi',
    summary: 'Personel izin taleplerini kaydeder ve durumlarını takip edersiniz.',
    topics: [
      {
        title: 'İzin ekleme',
        steps: ['Personeli seçin.', 'İzin türü ve tarih aralığını girin.', 'Kaydedin.'],
      },
    ],
  },
  '/duty': {
    title: 'Nöbet Programı',
    summary: 'Haftalık nöbet yerleri ve öğretmen atamalarını planlarsınız.',
    topics: [
      {
        title: 'Yerleşim',
        steps: [
          'Nöbet yerlerini (koridor, bahçe vb.) tanımlayın.',
          'Hafta görünümünde hücreye tıklayıp öğretmen seçin.',
          'Gerekirse kapasite ayarını düzenleyin.',
        ],
      },
      {
        title: 'Dışa aktarma',
        body: 'Hazır programı Excel / PDF olarak indirebilirsiniz.',
      },
    ],
  },
  '/extra-lessons': {
    title: 'Ek Ders ve Ücret Puantajı',
    summary: 'Ek ders / ücret puantaj kayıtlarını tutar ve raporlarsınız.',
    topics: [
      {
        title: 'Puantaj girişi',
        steps: ['Dönem veya ay bilgisini seçin.', 'Öğretmen / personel satırlarına saat veya gün girin.', 'Kaydedin.'],
      },
    ],
  },
  '/attendance': {
    title: 'İşçi / TYP Puantaj Takibi',
    summary: 'İşçi ve TYP personelinin devam / puantajını takip edersiniz.',
    topics: [
      {
        title: 'Günlük işaretleme',
        body: 'Tarih seçip ilgili personelin devam durumunu işaretleyin ve kaydedin.',
      },
    ],
  },
  '/schedule': {
    title: 'Ders Dağıtım ve Ders Programı',
    summary: 'Haftalık ders programını oluşturur ve öğretmen / sınıf dağıtımını yönetirsiniz.',
    topics: [
      {
        title: 'Program hazırlama',
        steps: [
          'Sınıf veya öğretmen görünümünü seçin.',
          'Boş saate ders atayın.',
          'Çakışma uyarılarını kontrol edip kaydedin.',
        ],
      },
    ],
  },
  '/exams': {
    title: 'Sınav Programı Hazırlama',
    summary: 'Sınav tarih, ders ve salon planlamasını yönetirsiniz.',
    topics: [
      {
        title: 'Sınav ekleme',
        steps: ['Yeni sınav kaydı oluşturun.', 'Tarih, ders ve sınıf bilgilerini girin.', 'Kaydedin.'],
      },
    ],
  },
  '/kelebek': {
    title: 'Kelebek Sistemi',
    summary: 'Sınav salon ve oturma planı (kelebek) oluşturur; çıktı alabilirsiniz.',
    topics: [
      {
        title: 'Plan oluşturma',
        steps: [
          'Sınav / sınıf seçimini yapın.',
          'Salon ve sıra düzenini oluşturun.',
          'Sonucu yazdırın veya dışa aktarın.',
        ],
      },
    ],
  },
  '/absences': {
    title: 'DYK Devamsızlık Takibi',
    summary: 'DYK / destekleme kursu devamsızlık kayıtlarını girer ve takip edersiniz.',
    topics: [
      {
        title: 'Devamsızlık girişi',
        steps: ['Tarih ve sınıf / grup seçin.', 'Öğrenci durumunu işaretleyin.', 'Kaydedin.'],
      },
    ],
  },
  '/dyk': {
    title: 'DYK',
    summary: 'Destekleme ve yetiştirme kursu (DYK) ile ilgili kayıt ve takip işlemleri.',
    topics: [
      {
        title: 'Kullanım',
        body: 'Listeden ilgili kaydı seçin; ekleme / düzenleme yetkinize göre işlem yapın.',
      },
    ],
  },
  '/communications': {
    title: 'Veli İletişim, Duyuru ve Bildirim',
    summary: 'Velilere duyuru ve SMS / bildirim gönderir; hedef kitleyi seçersiniz.',
    topics: [
      {
        title: 'Duyuru gönderme',
        steps: [
          'Yeni duyuru oluşturun.',
          'Başlık, metin ve kanalı (SMS / e-posta / uygulama) seçin.',
          'Hedef sınıf veya öğrencileri belirleyip gönderin.',
        ],
      },
      {
        title: 'SMS notu',
        body: 'SMS için öğrencinin veli telefonu tanımlı olmalıdır; aksi halde alıcı iptal / başarısız sayılır.',
      },
    ],
  },
  '/discipline': {
    title: 'Disiplin Modülü',
    summary: 'Disiplin olaylarını kaydeder, süreç ve sonuçlarını takip edersiniz.',
    topics: [
      {
        title: 'Olay kaydı',
        steps: ['Yeni olay ekleyin.', 'Öğrenci, tarih ve açıklamayı girin.', 'Durumu güncelleyip kaydedin.'],
      },
    ],
  },
  '/guidance': {
    title: 'Rehberlik Modülü',
    summary: 'Rehberlik görüşme ve notlarını kayıt altına alırsınız.',
    topics: [
      {
        title: 'Görüşme ekleme',
        steps: ['Öğrenciyi seçin.', 'Görüşme notunu yazın.', 'Kaydedin.'],
      },
    ],
  },
  '/users': {
    title: 'Kullanıcılar ve Yetkilendirme',
    summary: 'Sistem kullanıcılarını ve yetki gruplarını yönetirsiniz.',
    topics: [
      {
        title: 'Menü düzeni',
        body: 'Hesap yöneticileri sol menünün altındaki Menüyü düzenle ile sırayı, grupları ve gizlenen öğeleri tüm kurum için ayarlayabilir.',
      },
      {
        title: 'Yetki grupları',
        body: 'Yetki Grupları sekmesinde menü bazlı izinleri (görüntüle / ekle / düzenle / sil) tanımlayın.',
      },
      {
        title: 'Kullanıcı ekleme',
        steps: [
          'Kullanıcılar sekmesinde Yeni Kullanıcı’ya tıklayın.',
          'Ad, e-posta, okul, yetki grubu ve isteğe bağlı telefon (SMS için) girin.',
          'Şifre belirleyip oluşturun.',
        ],
      },
    ],
  },
  '/work-tasks': {
    title: 'İş Takibi',
    summary: 'Periyodik görevler oluşturur; hatırlatma ve gecikme bildirimlerini yönetirsiniz.',
    topics: [
      {
        title: 'Görev oluşturma',
        steps: [
          'Yeni görev ile formu açın.',
          'Başlık, atanan kullanıcı, periyot ve son tarihi seçin.',
          'Zorunlu iş ve uyarı tiplerini (uygulama / SMS / e-posta) işaretleyin.',
          'Oluştur ile kaydedin.',
        ],
      },
      {
        title: 'Tamamlama',
        body: 'Atanan kişi veya düzenleme yetkisi olanlar Yapıldı ile görevi tamamlar. Tekrarlayan görevlerde sonraki vade otomatik ilerler.',
      },
      {
        title: 'Bildirimler',
        body: 'Hatırlatma süresi dolunca ve zorunlu iş gecikince seçilen kanallara bildirim gider. SMS için kullanıcının telefonu dolu olmalıdır.',
      },
      {
        title: 'Kurum Takvimi',
        body: 'Görev vadelerini ay görünümünde görmek için Sistem → Kurum Takvimi sayfasını kullanın.',
      },
    ],
  },
  '/calendar': {
    title: 'Kurum Takvimi',
    summary: 'İş takibi ve ileride eklenecek diğer programların (ör. sınav) tarihlerini tek takvimde gösterir.',
    topics: [
      {
        title: 'Kaynak filtreleri',
        body: 'Üstteki kutularla hangi kaynakların gösterileceğini seçin. Yalnızca yetkiniz olan kaynaklar listelenir.',
      },
      {
        title: 'Gün detayı',
        body: 'Bir güne tıklayarak o gündeki olayları ve ilgili sayfaya (ör. İş Takibi) geçiş bağlantısını görün.',
      },
    ],
  },
  '/message-logs': {
    title: 'SMS / E-posta Kayıtları',
    summary: 'Sistem tarafından gönderilen SMS ve e-postaların salt okunur kaydı (duyurular, görev bildirimleri).',
    topics: [
      {
        title: 'Görüntüleme',
        body: 'Kanal, durum veya alıcıya göre filtreleyip arama yapabilirsiniz. Kayıtlar düzenlenemez veya silinemez.',
      },
      {
        title: 'Gizleme',
        body: 'Gizle ile bir kayıt yalnızca kendi listenizden kaldırılır; diğer kullanıcılar görmeye devam eder. Gizlenenler sekmesinden geri alabilirsiniz.',
      },
    ],
  },
  '/audit-logs': {
    title: 'Denetim Kayıtları',
    summary: 'Sistemde yapılan kritik işlemlerin kim / ne zaman / ne yaptığını gösterir (salt okunur).',
    topics: [
      {
        title: 'İnceleme',
        body: 'Tarih veya işlem türüne göre listeyi inceleyin. Kayıtlar silinemez; denetim amaçlıdır.',
      },
    ],
  },
  '/feedback': {
    title: 'Geri Bildirim',
    summary: 'Uygulama hakkında öneri veya sorun bildirimi gönderirsiniz.',
    topics: [
      {
        title: 'Gönderim',
        steps: ['Konu ve açıklamayı yazın.', 'Gönder’e tıklayın.', 'Durumu listeden takip edebilirsiniz.'],
      },
    ],
  },
  '/platform/tenants': {
    title: 'Hesap Yönetimi',
    summary: 'Platform yöneticisi olarak tenant (kurum) hesaplarını listeler ve yönetirsiniz.',
    topics: [
      {
        title: 'Yeni hesap',
        body: 'Sihirbaz ile kurum, okul ve yönetici kullanıcısını oluşturabilirsiniz.',
      },
      {
        title: 'Detay',
        body: 'Hesap satırından detaya giderek kullanıcı, lisans ve okul özetini görürsünüz.',
      },
    ],
  },
  '/platform/licenses': {
    title: 'Lisans Yönetimi',
    summary: 'Tenant lisanslarını tanımlar, plan ve süre bilgisini yönetirsiniz.',
    topics: [
      {
        title: 'Lisans tanımlama',
        steps: ['Tenant seçin.', 'Plan ve tarihleri girin.', 'Kaydedin; önceki aktif lisans iptal edilebilir.'],
      },
    ],
  },
  '/platform/feedback': {
    title: 'Geri Bildirimler (Platform)',
    summary: 'Kurumlardan gelen geri bildirimleri inceler ve durumunu güncellersiniz.',
    topics: [
      {
        title: 'İşleme alma',
        body: 'Kaydı açın, durumunu (incelemede / çözüldü vb.) güncelleyin.',
      },
    ],
  },
  '/platform/notifications': {
    title: 'Bildirimler (Platform)',
    summary: 'Platform genelinde kullanıcılara bildirim gönderirsiniz.',
    topics: [
      {
        title: 'Bildirim oluşturma',
        steps: ['Başlık ve metni yazın.', 'Hedef kitleyi seçin.', 'Gönderin.'],
      },
    ],
  },
  '/platform/backups': {
    title: 'Veritabanı Yedekleme',
    summary: 'Yedek alma ve yedek listesini yönetirsiniz (platform yöneticisi).',
    topics: [
      {
        title: 'Yedek alma',
        body: 'Yedek oluştur komutuyla anlık yedek alın; listeden indirilebilir yedekleri kontrol edin.',
      },
    ],
  },
}

/** Dinamik yollar (ör. /platform/tenants/12) için önek eşlemesi. */
const PREFIX_HELP: Array<{ prefix: string; content: PageHelpContent }> = [
  {
    prefix: '/platform/tenants/',
    content: {
      title: 'Hesap Detayı',
      summary: 'Seçili kurumun okulları, kullanıcıları ve lisans özetini görürsünüz.',
      topics: [
        {
          title: 'Ne yapılır?',
          steps: [
            'Okul ve kullanıcı sayılarını kontrol edin.',
            'Lisans durumunu inceleyin.',
            'Gerekirse lisans yönetimi sayfasından planı güncelleyin.',
          ],
        },
      ],
    },
  },
]

export function getPageHelp(pathname: string): PageHelpContent {
  const exact = PAGE_HELP[pathname]
  if (exact) return exact

  for (const entry of PREFIX_HELP) {
    if (pathname.startsWith(entry.prefix)) return entry.content
  }

  // En uzun eşleşen menü yolu
  const keys = Object.keys(PAGE_HELP).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (key !== '/' && pathname.startsWith(`${key}/`)) return PAGE_HELP[key]
  }

  return DEFAULT_HELP
}
