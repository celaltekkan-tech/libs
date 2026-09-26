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
        body: 'Okul, öğretmen, öğrenci ve yaklaşan iş sayılarını gösterir. Platform yöneticisinde hesap kartı ayrıca çevrimiçi tenant ve alt kullanıcı sayısını verir. Özet kartlar dakikada bir yenilenir. Karta tıklayarak ilgili sayfaya gidebilirsiniz.',
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
      {
        title: 'Sunucu durumu',
        body: 'Platform yöneticisi ana sayfasında işlemci, bellek, disk ve veritabanı yoğunluğu birkaç saniyede bir yenilenir. Veritabanı çubuğu, eşzamanlı aktif sorgular işlemci çekirdeği sayısına yaklaştıkça dolar.',
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
      {
        title: 'İki adımlı doğrulama',
        body: 'Okul yöneticisi Hesap güvenliği kartından authenticator’ı açar; ardından her kullanıcı kendi kurulumunu başlatır. Platform yöneticisi kendi 2FA kurulumunu Profilim’den doğrudan başlatır.',
      },
    ],
  },
  '/schools': {
    title: 'Okullar',
    summary: 'Kuruma bağlı okul kayıtlarını ekler, düzenler ve listelersiniz.',
    topics: [
      {
        title: 'Yeni okul',
        steps: [
          'Yeni Okul butonuna tıklayın.',
          'İl ve ilçeyi seçin, ardından katalogdan okul adını seçin.',
          'Okul listede yoksa «Okul listede yok, yeni ad gireceğim» kutusunu işaretleyip adı yazın.',
          'Gerekiyorsa kademe ve okul kodunu kontrol edip kaydedin.',
        ],
        body: 'Katalogdan seçilen okullarda MEB kurum kodu varsa otomatik dolar. Okul sayısı plana göre sınırlıdır: Standart’ta 1, Premium’da en fazla 3 okul.',
      },
      {
        title: 'Düzenleme / silme',
        body: 'Satırdaki düzenle veya sil işlemleriyle mevcut kaydı güncelleyebilirsiniz (yetkiye bağlı). Hesapta en az bir okul kalmalıdır; listede tek okul varken silme kapalıdır. Düzenle formundan okul logosu yükleyebilirsiniz; logosu olan okulların e-postalarında bu logo kullanılır. Birinci ve ikinci yabancı dil, sorumluluk sınavında Yabancı Dil ile İkinci Yabancı Dil derslerinin öğretmenini belirler.',
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
          'Kimlik, sınıf, anne/baba adı ve veli iletişim bilgilerini girin.',
          'İsterseniz öğrenci fotoğrafı yükleyin.',
          'Kayıt durumunu seçip kaydedin.',
        ],
      },
      {
        title: 'Arama ve filtre',
        body: 'Ad, numara veya T.C. ile arayabilirsiniz. Filtre alanları butonuyla öğrenci kartındaki tüm alanlardan hangilerinin görüneceğini seçersiniz; tercih bu tarayıcıda size özel saklanır. Okul üst çubuktan seçilir.',
      },
      {
        title: 'Yaş',
        body: 'Doğum tarihi girildiğinde yaş hesaplanır. Kayıtlar her gece doğum gününe göre otomatik güncellenir.',
      },
    ],
  },
  '/teachers': {
    title: 'Öğretmenler',
    summary: 'Öğretmen kadrosunu ekler, branş ve okul bağlantılarını yönetirsiniz.',
    topics: [
      {
        title: 'Öğretmen kaydı',
        steps: [
          'Yeni Öğretmen butonunu kullanın.',
          'Kimlik, doğum tarihi, branş ve iletişim bilgilerini doldurun.',
          'Kaydedin.',
        ],
      },
      {
        title: 'Satır detayı',
        body: 'Öğretmen satırının herhangi bir yerine tıkladığınızda listede görünmeyen bilgiler açılır. Okul müdürü, seçili okula müdür rolüyle atanmış hesaptan gelir.',
      },
      {
        title: 'Liste filtreleri',
        body: 'Filtre alanları ile öğretmen kartındaki tüm alanlardan hangilerinin filtreleneceğini seçebilirsiniz. Tercih bu tarayıcıda size özel saklanır.',
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
    title: 'Norm Kadro',
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
  '/promotions': {
    title: 'Terfi Takibi',
    summary: 'Öğretmen ve memurların derece/kademe ilerlemesini, 8 yıllık ceza-siz bonusu ve kariyer terfisini takip eder.',
    topics: [
      {
        title: 'Yıllık kademe ilerlemesi',
        body: 'Ay seçerek o dönemin terfilerini görün. Dönem, seçilen ayın 14’ü ile bir önceki ayın 15’i arasıdır. "Terfiyi Uygula" formu indirir.',
      },
      {
        title: '8 yıllık kontrol',
        body: 'Ceza almadan 8 yıl geçen personelde kademe bonusu uygulanır; ceza varsa tarihini girerek sayaç sıfırlanır.',
      },
      {
        title: 'Kariyer terfisi',
        body: 'Uzman Öğretmen / Başöğretmen olan öğretmene tek seferlik derece -1 uygulanır.',
      },
      {
        title: 'Terfi tarihini değiştirme',
        body: 'Özel durumlarda terfi tarihi değiştirilebilir; sebep girilmesi zorunludur. Sürekli seçilirse takvim o tarihe göre devam eder, tek seferlik seçilirse sıradaki yıllık takvim değişmez.',
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
  '/schedule-builder': {
    title: 'Otomatik Ders Programı',
    summary:
      'Ders programını matematiksel çözücü (OR-Tools) hazırlar; istekleri isterseniz yapay zekâya Türkçe yazarak kısıta çevirirsiniz.',
    topics: [
      {
        title: 'Adımlar',
        steps: [
          'Yeni çalışma oluşturun; gün, günlük ders saati ve öğle arasını ayarlayın.',
          'Laboratuvar, spor salonu gibi paylaşılan mekanları tanımlayın.',
          '"Ders Atamaları"nda "Otomatik Doldur" ile atamaları oluşturun, eksik öğretmenleri seçin.',
          '"Kısıtlar"da istekleri yazın (ör. "Ayşe Hoca cuma gelemiyor") ve önerileri onaylayın.',
          '"Oluştur"da ön kontrolü yapıp programı oluşturun.',
          '"Program"da sürükle-bırak ile düzeltin, gerekirse kilitleyip yeniden oluşturun, sonra yayınlayın.',
        ],
      },
      {
        title: 'Kesin ve esnek kurallar',
        body: 'Kesin kurallar asla ihlal edilmez; çelişirlerse çözücü hangilerinin çeliştiğini söyler. Esnek kurallara önem puanına göre mümkün olduğunca uyulur.',
      },
    ],
  },
  '/exams': {
    title: 'Sınav Programı Hazırlama',
    summary: 'Ortak sınav ve sorumluluk sınavı programını derslere göre takvime yerleştirirsiniz.',
    topics: [
      {
        title: 'Ortak sınav',
        steps: [
          'Ders programından gelen bir dersi seçin.',
          'Takvimde güne tıklayarak ortak sınavı yerleştirin.',
          'İsterseniz tarih aralığı seçip otomatik program oluşturun.',
        ],
      },
      {
        title: 'Sorumluluk sınavı',
        steps: [
          'MEBBİS «Öğrencilerin Sorumlu Olduğu Dersler» Excel’ini (.xls / .xlsx) içe aktarın.',
          'Önizlemede öğrenci ve ders eşleşmelerini kontrol edin. Katalogda olmayan dersler önce eklenir, sonra kayıtlar içe aktarılır.',
          'Sorumlu olunan dersi seçip takvimde güne tıklayarak tüm öğrenciler için sınavı tarihlendirin. Yerleşen dersi basılı tutup başka güne sürükleyebilir, «Saat ekle» ile saat girebilirsiniz.',
          'Komisyon başkanı seçili okulun müdürüdür. İki üye, ders branşına göre önerilir. Her 30 öğrenci için bir gözetmen önerilir.',
          'Yabancı Dil ve Seçmeli Yabancı Dil, okulun birinci yabancı diline; İkinci Yabancı Dil, ikinci yabancı diline bağlanır.',
          'İngilizce, ikinci yabancı dil, Türk Dili ve Edebiyatı ve Türkçe derslerinde yazılı ve sözlü ayrı günlere konur. Sözlüde gözetmen yoktur.',
          'Aynı öğrencinin iki sınavı aynı güne gelirse sistem uyarır.',
        ],
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
        body: 'SMS göndermek için hesabın aktif SMS 3000 veya SMS 10000 lisansı ve yeterli kotası olmalıdır. Lisans bitince kullanılmayan krediler sıfırlanır. Veli telefonu tanımlı olmayan alıcılar iptal sayılır ve kota düşmez. Öğretmen kayıt SMS’i lisans gerektirmez.',
      },
    ],
  },
  '/discipline': {
    title: 'Disiplin Modülü',
    summary: 'Disiplin olaylarını kaydeder, süreç ve sonuçlarını takip edersiniz. Mobil öğretmen bildirimleri ayrı sekmededir.',
    topics: [
      {
        title: 'Olay kaydı',
        steps: ['Yeni olay ekleyin.', 'Öğrenci, tarih ve açıklamayı girin.', 'Durumu güncelleyip kaydedin.'],
      },
      {
        title: 'Öğretmen bildirimleri',
        body: 'Öğretmen Bildirimleri sekmesinde mobil uygulamadan gelen kayıtlar listelenir. Ad, öğrenci no, öğretmen ve sebeple arayabilir; sınıf, öğretmen ve sebep filtrelerini kullanabilirsiniz.',
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
  '/platform/roles': {
    title: 'Global Yetkiler',
    summary: 'Tüm kurumlarda kullanılan varsayılan yetki gruplarını (Müdür, Öğretmen vb.) düzenlersiniz.',
    topics: [
      {
        title: 'Yetki düzenleme',
        steps: [
          'Listeden bir sistem rolünü açın.',
          'Menü bazında görüntüle / ekle / düzenle / sil kutularını işaretleyin.',
          'Kaydet; değişiklik bu role atanmış tüm kullanıcılara yansır.',
        ],
      },
      {
        title: 'Yeni global grup',
        body: 'Yeni Yetki Grubu ile tüm kurumlarda seçilebilecek yeni bir sistem rolü tanımlayabilirsiniz.',
      },
    ],
  },
  '/platform/directory-schools': {
    title: 'MEB Okul Kataloğu',
    summary:
      'Türkiye genelindeki ortaokul ve liseleri il / ilçe bazında görürsünüz. Kiracılar okul eklerken bu referans listesinden seçer.',
    topics: [
      {
        title: 'Arama',
        steps: [
          'İl ve ilçe seçerek listeyi daraltın.',
          'Kademe (ortaokul / lise) filtresi uygulayın.',
          'Okul adıyla arama yapın.',
        ],
      },
    ],
  },
  '/platform/licenses': {
    title: 'Lisans Yönetimi',
    summary: 'Tenant lisanslarını tanımlar, plan ve süre bilgisini yönetirsiniz.',
    topics: [
      {
        title: 'Listeyi daraltma',
        body: 'Tablodaki arama kutusu tenant adı veya hesap numarasına göre lisansları süzer.',
      },
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
  '/platform/sms-test': {
    title: 'SMS Test',
    summary: 'Aktif SMS sağlayıcısının ayarlarını görür ve test mesajı gönderirsiniz (platform yöneticisi). Test gönderimleri lisans kotasından düşmez.',
    topics: [
      {
        title: 'Test gönderimi',
        steps: ['Telefonu 05xx biçiminde girin.', 'Mesajı yazıp Gönder deyin.', 'Sonucu ve süreyi son gönderimler listesinden izleyin.'],
      },
      {
        title: 'UDP motoru',
        body: 'Yanıt bekleme 0 ise “Başarılı” yalnızca paketin SMS motoruna gönderildiğini gösterir; teslimi telefondan doğrulayın.',
      },
    ],
  },
  '/platform/backups': {
    title: 'Veritabanı Yedekleme',
    summary: 'Yedek klasörünü, saati ve saklama süresini ayarlar; yedek alır, indirir, yükler veya geri yüklersiniz (platform yöneticisi).',
    topics: [
      {
        title: 'Zamanlanmış yedek',
        body: 'Yedek klasörü ve günün saati kaydedildikten sonra her gün o saatte (Europe/Istanbul) otomatik yedek alınır.',
      },
      {
        title: 'Manuel yedek ve geri yükleme',
        steps: [
          'Şimdi yedek al ile anlık yedek oluşturun.',
          'Listeden İndir ile .sql.gz dosyasını bilgisayarınıza kaydedin.',
          'Yedek yükle ile dışarıdan bir .sql.gz dosyasını listeye alın.',
          'Listeden Geri yükle deyip onay kelimesini yazarak seçilen yedeği veritabanına uygulayın.',
        ],
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
