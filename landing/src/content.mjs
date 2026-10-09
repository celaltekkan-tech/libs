// Sitenin tüm modül içeriği. Her modül /moduller/<slug> adresinde ayrı sayfa olur,
// anasayfadaki modül haritasında ve sitemap.xml'de yer alır.
// Kural: yalnızca uygulamada gerçekten olan özellik yazılır.

export const GROUPS = [
  {
    key: 'tanimlar',
    title: 'Temel Tanımlar',
    icon: '🏫',
    color: 'indigo',
    summary: 'Okul, sınıf, öğrenci ve personel kayıtlarını bir kez kurun; diğer tüm modüller bu veriyle çalışsın.',
  },
  {
    key: 'personel',
    title: 'Personel İşleri',
    icon: '🧑‍🏫',
    color: 'teal',
    summary: 'Terfi, rapor, nöbet, ek ders ve maaş bildirimi; personelle ilgili her süreç kayıt altında ve birbirine bağlı.',
  },
  {
    key: 'programlar',
    title: 'Programlar',
    icon: '🗓️',
    color: 'amber',
    summary: 'Ders programını, ortak ve sorumluluk sınavlarını, kelebek oturma planını otomatik hazırlayın.',
  },
  {
    key: 'ogrenci',
    title: 'Öğrenci İşleri',
    icon: '🎓',
    color: 'rose',
    summary: 'Devamsızlık, DYK, disiplin, rehberlik, veli iletişimi ve işletmede beceri eğitimi.',
  },
  {
    key: 'sistem',
    title: 'Sistem ve Güvenlik',
    icon: '🔐',
    color: 'slate',
    summary: 'Yetki, denetim kaydı, iş takibi, kurum takvimi, e-Okul eklentisi ve şifreli yedekleme.',
  },
]

export const MODULES = [
  // ───────────────────────── Temel Tanımlar
  {
    slug: 'okul-ve-sinif-tanimlari',
    group: 'tanimlar',
    name: 'Okul, Sınıf ve Ders Tanımları',
    short: 'Okul, sınıf ve dersler',
    icon: '🏫',
    title: 'Okul, Sınıf, Ders ve Eğitim-Öğretim Yılı Tanımları | OIDS',
    description:
      'MEB okul kataloğundan okul seçimi, sınıf/şube ve ders tanımları, eğitim-öğretim yılı ve resmî tatiller. OIDS okul idare yazılımının temel tanım modülü.',
    lead:
      'Okulunuzu MEB kataloğundan seçin, sınıf ve şubeleri e-Okul’dan çekin, dersleri ve eğitim-öğretim yılını tanımlayın. Ders programından sınav planına kadar her modül bu temel üzerine kurulur.',
    features: [
      ['MEB okul kataloğu', 'İl ve ilçeye göre okulunuzu seçin; MEB kurum kodu otomatik dolar. Ortaokul ve lise kataloğu hazırdır.'],
      ['Okul logosu ve müdür bilgisi', 'Logo okulunuzdan giden e-postalarda, müdür adı üretilen resmî belgelerde kullanılır.'],
      ['Sınıf / şube yönetimi', 'Kapasite ve sınıf öğretmeni ile şube tanımı; çok programlı meslek liselerinde AMP-A / ATP-A gibi adlandırmalar desteklenir.'],
      ['e-Okul’dan sınıf listesi', 'OIDS tarayıcı eklentisi e-Okul’daki şube listesini tek tıkla sisteme aktarır.'],
      ['Ders tanımları', 'Kültür ve meslek dersi ayrımı, haftalık saat seçenekleri.'],
      ['Eğitim-öğretim yılı ve tatiller', 'Dönem tanımları, aktif yıl seçimi ve tek tıkla varsayılan resmî tatil listesi.'],
      ['Yabancı dil bilgisi', 'Okulun 1. ve 2. yabancı dili sorumluluk sınavı planlamasında kullanılır.'],
      ['Excel, CSV, PDF dışa aktarım', 'Sınıf ve ders listeleri tek tıkla dışa aktarılır.'],
    ],
    related: ['ogrenci-yonetimi', 'ogretmen-ve-personel-yonetimi', 'otomatik-ders-programi'],
  },
  {
    slug: 'ogrenci-yonetimi',
    group: 'tanimlar',
    name: 'Öğrenci Yönetimi',
    short: 'Öğrenciler',
    icon: '🧒',
    title: 'Öğrenci Kayıt ve Yönetimi — e-Okul Excel İçe Aktarma | OIDS',
    description:
      'e-Okul öğrenci listesi ve fotoğraflı liste Excel’ini içe aktarın, veli bilgilerini tutun, kayıtları kaydedilmiş şablonlarla Excel ve PDF’e aktarın.',
    lead:
      'Öğrencileri tek tek girmek yok: e-Okul’dan aldığınız Excel listelerini önizleyerek içe aktarın, fotoğrafları e-Okul fotoğraflı listesinden otomatik çekin.',
    features: [
      ['e-Okul Excel içe aktarma', 'Birden fazla sınıfın aynı sayfada olduğu listeler dahil; önizleme, sütun eşleştirme ve mevcut kayıtları güncelleme.'],
      ['Fotoğraflı liste', 'e-Okul fotoğraflı öğrenci listesindeki (XLS) fotoğraflar otomatik ayrıştırılıp öğrenci kartına eklenir.'],
      ['Veli ve iletişim bilgileri', 'Veli telefonları, pansiyon durumu ve kayıt durumu öğrenci kartında.'],
      ['Kayıtlı dışa aktarım şablonları', 'Hangi sütunları istediğinizi bir kez seçin; Excel, CSV veya PDF listeler aynı düzende çıksın.'],
      ['Otomatik yaş hesabı', 'Öğrenci yaşları her gece kendiliğinden güncellenir.'],
      ['Okul numarasıyla hızlı arama', 'Öğretmenler mobil uygulamadan okul numarasıyla öğrenciyi fotoğrafıyla bulur.'],
    ],
    related: ['devamsizlik-ve-dyk-takibi', 'disiplin', 'veli-iletisim'],
  },
  {
    slug: 'ogretmen-ve-personel-yonetimi',
    group: 'tanimlar',
    name: 'Öğretmen ve Personel Yönetimi',
    short: 'Öğretmen ve personel',
    icon: '👩‍🏫',
    title: 'Öğretmen ve Personel Yönetimi — MEBBİS Excel, Görevlendirme Yazıları | OIDS',
    description:
      'MEBBİS personel listesini içe aktarın; görevlendirme, başlama ve ayrılış yazılarını Word olarak üretin. Kadrolu, ücretli ve dış kurum öğretmen takibi.',
    lead:
      'MEBBİS’ten aldığınız personel listesini içe aktarın; kadrolu, ücretli ve görevlendirme öğretmenlerini, memur ve hizmetli gibi diğer personeli tek yerde yönetin.',
    features: [
      ['MEBBİS Excel içe aktarma', '“Personel Listesi Özet Bilgiler” dosyası önizlemeyle içeri alınır.'],
      ['Görev türleri', 'Kadrolu, ücretli ve dış kurum görevlendirmesi (tam zamanlı veya ders tamamlama) ayrı izlenir.'],
      ['Kadro bilgileri', 'Derece, kademe ve kariyer basamağı kayıtlıdır; terfi takibi bu bilgiyle çalışır.'],
      ['Resmî yazılar (Word)', 'Görevlendirme, Başlama ve Ayrılış yazıları .docx olarak tek tıkla üretilir.'],
      ['Ayrılış → maaş formu', 'Personelin ayrılışını kaydettiğinizde Maaş Değişikliği Bildirim Formu’nun B bölümüne otomatik eklenir.'],
      ['Diğer personeller', 'Memur, hizmetli, güvenlik gibi personel için kendi kategorilerinizi tanımlayın; aynı yazılar ve ayrılış akışı geçerlidir.'],
      ['Excel, CSV, PDF dışa aktarım', 'Personel listeleri dilediğiniz sütunlarla dışa aktarılır.'],
    ],
    related: ['terfi-takibi', 'maas-degisikligi-bildirim-formu', 'ogretmen-evrak-arsivi'],
  },

  // ───────────────────────── Personel İşleri
  {
    slug: 'terfi-takibi',
    group: 'personel',
    name: 'Terfi Takibi (Kademe / Derece)',
    short: 'Terfi takibi',
    icon: '📈',
    title: 'Öğretmen Kademe ve Derece Terfi Takibi | OIDS',
    description:
      'Aylık terfi dönemleri, kademe/derece ilerletme, terfi formu Excel çıktısı ve 8 yıl cezasız kademe kontrolü. Terfiler maaş değişikliği formuna otomatik akar.',
    lead:
      'Hangi personelin bu ay terfisi var, kimin 8 yıllık cezasız kademe hakkı doldu; takvime bakmanıza gerek yok. OIDS listeler, siz onaylarsınız.',
    features: [
      ['Aylık terfi dönemleri', 'Önceki ayın 15’i ile içinde bulunulan ayın 14’ü arasındaki terfiler otomatik listelenir.'],
      ['Tek tıkla “Terfiyi Uygula”', 'Kademe/derece ilerletilir ve resmî şablondan doldurulmuş terfi formu Excel olarak iner.'],
      ['8 yıl cezasız kademe', 'Hak kazanan personel ayrıca işaretlenir.'],
      ['Uzman Öğretmen / Başöğretmen', 'Kariyer basamağına bağlı tek seferlik derece ilerlemesi desteklenir.'],
      ['Terfi tarihi düzeltme', 'Gerekçeli olarak kalıcı veya tek seferlik tarih değişikliği.'],
      ['Maaş formuna otomatik aktarım', 'Uygulanan terfiler Maaş Değişikliği Bildirim Formu’na kendiliğinden yazılır.'],
    ],
    related: ['maas-degisikligi-bildirim-formu', 'ogretmen-ve-personel-yonetimi', 'rapor-takibi'],
  },
  {
    slug: 'maas-degisikligi-bildirim-formu',
    group: 'personel',
    name: 'Maaş Değişikliği Bildirim Formu ve Norm Kadro',
    short: 'Maaş formu ve norm kadro',
    icon: '🧾',
    title: 'Maaş Değişikliği Bildirim Formu — Otomatik Doldurma | OIDS',
    description:
      'Ayrılış, terfi ve 7 günü aşan raporlar maaş değişikliği bildirim formuna kendiliğinden yazılır. Resmî şablonda Excel veya PDF çıktı; branş bazlı norm kadro.',
    lead:
      'Ay sonunda maaş değişikliği formu için kimin ayrıldığını, kimin terfi aldığını, kimin raporu 7 günü aştığını aramayın. OIDS bu bilgileri ay boyunca forma kendisi işler.',
    features: [
      ['A–D bölümleri hazır', 'Her ay için taslak form; bölümler resmî formdaki düzenle aynıdır.'],
      ['Ayrılışlar otomatik', 'Personel ayrılışı kaydedilince B bölümüne eklenir.'],
      ['Terfiler otomatik', 'Terfi Takibi’nde uygulanan kademe/derece değişiklikleri forma işlenir.'],
      ['Raporlar otomatik', 'Takvim yılı içinde 7 günü aşan rapor günleri, raporun düştüğü ayın formuna yazılır.'],
      ['Resmî şablon çıktısı', 'Doldurulmuş Excel veya yazdırılabilir PDF.'],
      ['Norm kadro', 'Branş bazında norm ve mevcut kadroyu karşılaştırın.'],
    ],
    related: ['rapor-takibi', 'terfi-takibi', 'ogretmen-ve-personel-yonetimi'],
  },
  {
    slug: 'rapor-takibi',
    group: 'personel',
    name: 'Rapor (Sağlık İzni) Takibi',
    short: 'Rapor takibi',
    icon: '🩺',
    title: 'Personel Rapor Takibi — 7 Gün Kuralı ve Maaş Kesintisi | OIDS',
    description:
      'Öğretmen, memur ve yöneticilerin sağlık raporlarını takvim üzerinde izleyin. Yıllık 7 günü aşan rapor günleri maaş değişikliği formuna otomatik yazılır.',
    lead:
      'Raporları girin, gerisini sistem hesaplasın: takvim yılı içinde ilk 7 gün kesintisizdir, aşan günler doğru ayın maaş formuna kendiliğinden düşer.',
    features: [
      ['Kişi ve takvim görünümü', 'Kim, hangi tarihlerde raporlu; personel bazında veya takvimde görün.'],
      ['Otomatik 7 gün hesabı', 'Takvim yılındaki toplam rapor günü izlenir; 7’yi aşan kısım ayrıca hesaplanır.'],
      ['Maaş formuna aktarım', 'Aşan günler, raporun düştüğü ayın Maaş Değişikliği Bildirim Formu’na yazılır.'],
      ['Ek derse etkisi', 'Rapor günleri ek ders puantajı önerisinden otomatik düşülür.'],
      ['Ders programına etkisi', 'Rapor dönemleri ders programında kısıt olarak dikkate alınır.'],
      ['Toplu silme ve dışa aktarım', 'Listeyi Excel, CSV veya PDF olarak alın.'],
    ],
    related: ['maas-degisikligi-bildirim-formu', 'ek-ders-puantaji', 'nobet-programi'],
  },
  {
    slug: 'nobet-programi',
    group: 'personel',
    name: 'Nöbet Programı',
    short: 'Nöbet programı',
    icon: '🛎️',
    title: 'Öğretmen Nöbet Çizelgesi — Otomatik ve Adil Dağıtım | OIDS',
    description:
      'Nöbet yerlerini tanımlayın, haftalık nöbet çizelgesini otomatik ve adil dağıtın. Nöbet kuralları ve müdür imzalı Excel/PDF çıktı.',
    lead:
      'Nöbet yerlerini bir kez tanımlayın; OIDS haftalık çizelgeyi öğretmenlerin ders programına bakarak dağıtır ve kimin kaç nöbet tuttuğunu adalet raporunda gösterir.',
    features: [
      ['Otomatik dağıtım', 'Haftalık ızgara tek tıkla dolar; dilerseniz elle düzenleyin.'],
      ['Adalet raporu', 'Kişi başına nöbet sayısını görün, dengesizliği hemen fark edin.'],
      ['Ders programıyla uyum', 'Yayınlanmış ders programında dersi olan öğretmenler önce önerilir.'],
      ['Hafta kopyalama ve kilitleme', 'Haftayı kopyalayın, aralık temizleyin, belirli kişileri kilitleyin.'],
      ['Yazdırmaya hazır çıktı', 'Nöbet kuralları ve müdür imzasıyla siyah-beyaz kart düzeninde Excel ve PDF.'],
    ],
    related: ['otomatik-ders-programi', 'rapor-takibi', 'ogretmen-ve-personel-yonetimi'],
  },
  {
    slug: 'ek-ders-puantaji',
    group: 'personel',
    name: 'Ek Ders Puantajı',
    short: 'Ek ders puantajı',
    icon: '💰',
    title: 'Ek Ders Puantajı — KBS Kodları ile Otomatik Hesap | OIDS',
    description:
      'Ücretli ve dış kurum (ders tamamlama, görevlendirme) öğretmenleri için aylık ek ders puantajı. Ders programından öneri, KBS 101-123 kodları otomatik hesaplanır.',
    lead:
      'Ücretli ve dış kurumdan gelen öğretmenlerin aylık ek derslerini ders programından öneri olarak alın; devamsızlığı işaretleyin, KBS kodlarını sistem hesaplasın.',
    features: [
      ['Ayrı sekmeler', 'Ücretli öğretmenler ile dış kurum (ders tamamlama / görevlendirme) öğretmenleri ayrı izlenir.'],
      ['Ders programından öneri', 'Aylık ders yükü, yayınlanmış ders programından önerilir.'],
      ['Devamsızlık takvimi', 'Gelinmeyen günler ve kısmi saatler takvimde işaretlenir; raporlar otomatik düşülür.'],
      ['KBS kodları', '101, 102, 119, 121, 122, 123 kodları; YEP, sosyal kişilik hizmeti, gece ve hafta sonu dersleri hesaplanır.'],
      ['15 saat kuralı', 'Maaş karşılığı ilk 15 saat kuralı hesaba otomatik katılır.'],
    ],
    related: ['otomatik-ders-programi', 'rapor-takibi', 'isci-typ-puantaj'],
  },
  {
    slug: 'isci-typ-puantaj',
    group: 'personel',
    name: 'İşçi / TYP Puantajı',
    short: 'İşçi / TYP puantaj',
    icon: '🗂️',
    title: 'TYP ve İşçi Puantajı — İŞKUR EK-2 Excel Çıktısı | OIDS',
    description:
      'Okulda çalışan TYP ve işçi personelin günlük devamını işaretleyin, fazla mesai ve kapalı günleri girin; İŞKUR TYP EK-2 formunu Excel olarak alın.',
    lead:
      'Toplum Yararına Program (TYP) ve işçi personelin puantajını günlük işaretleyin, ay sonunda İŞKUR’a verilecek EK-2 formu hazır olsun.',
    features: [
      ['Günlük devam', 'Toplu giriş, fazla mesai saatleri ve okulun kapalı olduğu günler.'],
      ['Aylık özet', 'Kişi bazında çalışılan gün ve mesai toplamı.'],
      ['İŞKUR TYP EK-2', 'Form başına 3 veya 4 kişilik resmî düzende Excel çıktı.'],
      ['PDF ve CSV', 'Özet PDF ve ham CSV dışa aktarımı.'],
    ],
    related: ['ek-ders-puantaji', 'ogretmen-ve-personel-yonetimi', 'rapor-takibi'],
  },
  {
    slug: 'ogretmen-evrak-arsivi',
    group: 'personel',
    name: 'Öğretmen Evrak Arşivi',
    short: 'Evrak arşivi',
    icon: '📁',
    title: 'Öğretmen Evrak Takibi — Yıllık Plan, Zümre Tutanağı Onayı | OIDS',
    description:
      'Yıllık plan, zümre tutanağı, kulüp raporu gibi öğretmen evraklarını taslak, teslim ve onay akışıyla takip edin; onaylı evrak kilitlenir.',
    lead:
      'Yıllık planlar, zümre tutanakları, kulüp ve gelişim raporları... Hangi öğretmen teslim etti, hangisi revizyon bekliyor; hepsi tek listede.',
    features: [
      ['Kategoriler', 'Mevzuat, yıllık evrak, dilekçe, sınıf rehberlik ve maarif evrakları.'],
      ['Evrak türleri', 'Yıllık plan, zümre tutanağı, kulüp raporu, öğrenci gelişim raporu ve dahası.'],
      ['Onay akışı', 'Taslak → Teslim Edildi → Onaylandı / Revizyon İstendi. Onaylanan evrak kilitlenir.'],
      ['Yeni yıla kopyalama', 'Geçen yılın evrakını yeni yıla taşıyıp güncelleyin.'],
      ['Hazır başvuru belgeleri', 'Ek Ders Yönetmeliği, Ortaöğretim Kurumları Yönetmeliği ve Ayakta Tedavi Beyan Belgesi indirilebilir.'],
    ],
    related: ['ogretmen-ve-personel-yonetimi', 'is-takibi-ve-kurum-takvimi', 'rehberlik'],
  },

  // ───────────────────────── Programlar
  {
    slug: 'otomatik-ders-programi',
    group: 'programlar',
    name: 'Otomatik Ders Programı',
    short: 'Otomatik ders programı',
    icon: '🤖',
    title: 'Otomatik Ders Programı Hazırlama Yazılımı — Yapay Zekâ Destekli | OIDS',
    description:
      'Ders programını optimizasyon motoruyla otomatik hazırlayın: 13 kısıt türü, yapay zekâyla Türkçe kısıt, Bilsan/e-Okul içe aktarma ve e-Okul’a aktarım.',
    lead:
      'Zil saatlerini, ders havuzunu ve öğretmen atamalarını girin; OIDS’in optimizasyon motoru çakışmasız ders programını dakikalar içinde hazırlasın. Kısıtları dilerseniz Türkçe cümleyle yazın.',
    features: [
      ['Adım adım sihirbaz', 'Zil saatleri ve teneffüsler → ders havuzu → öğretmen ataması → uygunluk → seçmeli dersler → derslikler → kısıtlar → çözüm.'],
      ['Optimizasyon motoru', 'Google OR-Tools CP-SAT çözücüsü ve ek sezgisel yöntemler birlikte çalışır; en düşük cezalı sonuç seçilir.'],
      ['13 kısıt türü', 'Her kısıt zorunlu ya da tercih olarak, önem puanıyla tanımlanır. Çelişen zorunlu kurallar raporlanır.'],
      ['Türkçe yazın, kısıta dönüşsün', '“Ayşe Hanım cuma öğleden sonra ders vermesin” gibi cümleler yapay zekâyla yapılandırılmış kısıta çevrilir; siz onaylarsınız. Yapay zekâya TC kimlik no veya telefon gönderilmez.'],
      ['Hazır ders havuzları', 'MEB haftalık ders çizelgelerinden hazırlanmış havuzları okulunuza alın; ortak dersler şubelere otomatik eşitlenir.'],
      ['İçe aktarma', 'Bilsan öğretmen programı PDF’leri, e-Okul şube programı PDF’leri ve Excel.'],
      ['Sürükle-bırak düzenleme', 'Çözümden sonra elle ince ayar, kısmi silme ve yayınlama.'],
      ['Excel çıktılar', 'Şube, öğretmen, öğrenci, derslik, ayrıntılı ve tek sayfada “çarşaf” program.'],
      ['e-Okul’a aktarım', 'OIDS tarayıcı eklentisi yayınlanan programı e-Okul ders programı ekranına doldurur.'],
    ],
    faq: [
      ['Ders programı ne kadar sürede hazırlanır?', 'Veriler girildikten sonra çözüm genellikle dakikalar içinde tamamlanır; süre okulun büyüklüğüne ve kısıt sayısına bağlıdır.'],
      ['Bilsan’da hazırladığım programı alabilir miyim?', 'Evet. Bilsan öğretmen programı PDF’lerini ve e-Okul şube programı PDF’lerini içe aktarabilirsiniz.'],
      ['Yapay zekâ zorunlu mu?', 'Hayır. Çözücü yapay zekâ olmadan çalışır. Yapay Zekâ ek paketi; Türkçe kısıt yazma, ürün içi soru-cevap ve çözücünün sonuç bulamadığı durumda yerleştirme desteği ekler.'],
    ],
    related: ['e-okul-eklentisi', 'nobet-programi', 'ek-ders-puantaji'],
  },
  {
    slug: 'sinav-programi',
    group: 'programlar',
    name: 'Sınav Programı (Ortak ve Sorumluluk)',
    short: 'Sınav programı',
    icon: '📝',
    title: 'Ortak Sınav ve Sorumluluk Sınavı Programı Hazırlama | OIDS',
    description:
      'Ortak sınav ve sorumluluk sınavı programını otomatik hazırlayın. MEBBİS listesi içe aktarma, komisyon ve gözetmen önerisi, Excel/PDF/JPEG çıktı.',
    lead:
      'Ortak sınavları takvime yerleştirin, sorumluluk sınavlarını MEBBİS listesinden otomatik planlayın; komisyon ve gözetmen önerisi hazır gelsin.',
    features: [
      ['Ortak sınav planlama', 'Sınav dönemleri, takvim üzerinde yerleştirme ve otomatik program.'],
      ['Sorumluluk sınavı', 'MEBBİS “Öğrencilerin Sorumlu Olduğu Dersler” Excel’i içe aktarılır, program otomatik hazırlanır.'],
      ['Komisyon önerisi', 'Müdür ve branşa göre 2 üye; her 30 öğrenciye 1 gözetmen.'],
      ['Yazılı / sözlü ayrımı', 'Yabancı dil derslerinde yazılı ve sözlü sınav farklı günlere konur.'],
      ['Çakışma uyarısı', 'Aynı gün iki sınavı olan öğrenci için uyarı.'],
      ['Excel, PDF ve JPEG', 'Panoya asmak ve paylaşmak için görsel çıktı dahil.'],
    ],
    related: ['kelebek-sinav-sistemi', 'otomatik-ders-programi', 'okul-ve-sinif-tanimlari'],
  },
  {
    slug: 'kelebek-sinav-sistemi',
    group: 'programlar',
    name: 'Kelebek Sınav Sistemi',
    short: 'Kelebek sistemi',
    icon: '🦋',
    title: 'Kelebek Sınav Sistemi — Otomatik Oturma Planı | OIDS',
    description:
      'Sınav salonlarını kapasitesiyle tanımlayın, kelebek sistemine göre oturma planını otomatik oluşturun, gözetmen atayın ve yoklama alın.',
    lead:
      'Farklı sınıflardaki öğrencileri salonlara karışık yerleştiren kelebek oturma planını elle hazırlamayın; salonları tanımlayın, plan tek tıkla çıksın.',
    features: [
      ['Salon ve kapasite', 'Sınav salonları ve oturma kapasiteleri.'],
      ['Oturumlar', 'Her sınav oturumu ayrı planlanır.'],
      ['Otomatik oturma planı', 'Öğrenciler salonlara kelebek düzeninde dağıtılır.'],
      ['Gözetmen ve yoklama', 'Gözetmen ataması ve oturum yoklaması.'],
      ['Çıktı', 'Salon kapısına asılacak oturma planı listeleri.'],
    ],
    related: ['sinav-programi', 'ogrenci-yonetimi', 'okul-ve-sinif-tanimlari'],
  },

  // ───────────────────────── Öğrenci İşleri
  {
    slug: 'devamsizlik-ve-dyk-takibi',
    group: 'ogrenci',
    name: 'Devamsızlık ve DYK Takibi',
    short: 'Devamsızlık ve DYK',
    icon: '📋',
    title: 'Öğrenci Devamsızlık ve DYK Kurs Takibi | OIDS',
    description:
      'Destekleme ve Yetiştirme Kursları (DYK) yoklaması ve katılım oranı; öğrenci devamsızlığı toplu girişi, uyarı listesi ve PDF devamsızlık uyarı mektubu.',
    lead:
      'DYK kurslarının yoklamasını ve katılım oranlarını izleyin; öğrenci devamsızlığında sınıra yaklaşanları görün, veliye uyarı mektubunu tek tıkla hazırlayın.',
    features: [
      ['DYK kursları', 'Kurs tanımı, öğrenci kaydı ve yoklama.'],
      ['Katılım oranı', 'Kurs ve öğrenci bazında katılım özeti.'],
      ['Toplu devamsızlık girişi', 'Sınıf bazında hızlı işaretleme ve takvim görünümü.'],
      ['Uyarı listesi', 'Devamsızlık sınırına yaklaşan öğrenciler.'],
      ['Uyarı mektubu (PDF)', 'Veliye gönderilecek devamsızlık uyarı yazısı otomatik hazırlanır.'],
    ],
    related: ['veli-iletisim', 'ogrenci-yonetimi', 'rehberlik'],
  },
  {
    slug: 'veli-iletisim',
    group: 'ogrenci',
    name: 'Veli İletişimi (Toplu SMS)',
    short: 'Veli iletişimi',
    icon: '📣',
    title: 'Okul Veli SMS Duyuru Sistemi ve KVKK Onay Yönetimi | OIDS',
    description:
      'Seçtiğiniz sınıf ya da öğrencilerin velilerine toplu SMS duyurusu gönderin. Alıcı önizleme, alıcı bazında iletim kaydı ve KVKK açık rıza yönetimi.',
    lead:
      'Toplantı, gezi, sınav ya da acil durum duyurusunu seçtiğiniz sınıfların velilerine tek seferde SMS olarak gönderin; kime ulaştığını kayıtta görün.',
    features: [
      ['Hedefli duyuru', 'Sınıf veya öğrenci seçin, alıcı listesini göndermeden önce görün.'],
      ['Gerçek SMS gönderimi', 'Veli telefonlarına SMS; kullanım SMS paketi kotasından düşer.'],
      ['Alıcı bazında kayıt', 'Her alıcının iletim durumu SMS / E-posta Kayıtları’nda saklanır.'],
      ['KVKK onay yönetimi', 'Velilerin açık rıza durumları ayrı sekmede tutulur.'],
    ],
    related: ['devamsizlik-ve-dyk-takibi', 'disiplin', 'yetkilendirme-ve-guvenlik'],
  },
  {
    slug: 'disiplin',
    group: 'ogrenci',
    name: 'Disiplin Süreçleri',
    short: 'Disiplin',
    icon: '⚖️',
    title: 'Öğrenci Disiplin Süreçleri — Olay, İfade, Karar Belgeleri (Word) | OIDS',
    description:
      'Olay bazlı öğrenci disiplin takibi: ifade, kurul çağrısı, karar ve tebliğ belgeleri Word olarak. Öğretmenler mobil uygulamadan bildirim gönderir.',
    lead:
      'Disiplin sürecini olaydan karara kadar tek dosyada yürütün; ifade tutanağından tebliğ yazısına kadar tüm belgeler Word olarak hazır çıksın.',
    features: [
      ['Olay sihirbazı', 'Olayı, tarafları ve tanıkları adım adım kaydedin; ilgili olayları birleştirin.'],
      ['Word belgeler', 'Olay tutanağı, ifade, bilgi isteme, kurul toplantı çağrısı, karar ve tebliğ yazıları .docx olarak.'],
      ['Mevzuat madde kütüphanesi', 'Yönetmelik maddeleri ve davranış puanı tek yerde.'],
      ['Öğretmen bildirimleri', 'Öğretmenlerin mobil uygulamadan gönderdiği bildirimler ayrı sekmede; sebep istatistiği ve aynı sebep tekrarı uyarısı.'],
      ['Excel içe aktarma', 'Okul numarası veya TC kimlik numarasıyla toplu kayıt.'],
      ['Grafikler', 'Duruma ve ceza türüne göre dağılım.'],
    ],
    related: ['mobil-uygulama', 'rehberlik', 'veli-iletisim'],
  },
  {
    slug: 'isletmede-beceri-egitimi',
    group: 'ogrenci',
    name: 'İşletmede Beceri Eğitimi',
    short: 'İşletmede beceri eğitimi',
    icon: '🏭',
    title: 'İşletmede Beceri Eğitimi Takibi — Meslek Liseleri İçin | OIDS',
    description:
      'Meslek liseleri için işletme, usta öğretici ve öğrenci yerleştirme takibi; sözleşme özeti, aylık devam çizelgesi, devlet katkısı ve SGK giriş-çıkış listeleri.',
    lead:
      'Mesleki eğitimde öğrencilerin hangi işletmede, hangi usta öğreticiyle ve hangi sözleşmeyle olduğunu; aylık devlet katkısı ve SGK bildirimlerini tek ekranda izleyin.',
    features: [
      ['İşletmeler', 'İşletme bilgileri, usta öğreticiler ve SGK işyeri numarası.'],
      ['Öğrenci yerleştirme', 'Koordinatör öğretmen ve sözleşme bilgileriyle.'],
      ['Excel belgeler', 'Sözleşme özeti ve aylık devam çizelgesi.'],
      ['Devlet katkısı', 'Aylık katkı hesaplama ve ödeme takibi.'],
      ['SGK listeleri', 'Giriş-çıkış listeleri ve bildirildi işareti.'],
    ],
    related: ['ogrenci-yonetimi', 'devamsizlik-ve-dyk-takibi', 'okul-ve-sinif-tanimlari'],
  },
  {
    slug: 'rehberlik',
    group: 'ogrenci',
    name: 'Rehberlik Servisi',
    short: 'Rehberlik',
    icon: '💬',
    title: 'Rehberlik Servisi Görüşme Kayıtları ve Yönlendirme Takibi | OIDS',
    description:
      'Rehber öğretmenler için bireysel, grup ve veli görüşme kayıtları; RAM, sağlık kuruluşu ve sosyal hizmetlere yönlendirme takibi ve istatistikler.',
    lead:
      'Rehber öğretmenin görüşme kayıtları ve yönlendirmeleri, yalnızca yetkili kişilerin görebildiği ayrı bir modülde.',
    features: [
      ['Görüşme türleri', 'Bireysel, grup ve veli görüşmeleri.'],
      ['Yönlendirmeler', 'RAM, sağlık kuruluşu ve sosyal hizmetlere sevk kaydı.'],
      ['Öğrenci geçmişi', 'Öğrencinin tüm görüşmeleri tek zaman çizelgesinde.'],
      ['İstatistikler', 'Görüşme ve yönlendirme sayıları.'],
    ],
    related: ['disiplin', 'devamsizlik-ve-dyk-takibi', 'ogrenci-yonetimi'],
  },

  // ───────────────────────── Sistem
  {
    slug: 'yetkilendirme-ve-guvenlik',
    group: 'sistem',
    name: 'Yetkilendirme ve Güvenlik',
    short: 'Yetki ve güvenlik',
    icon: '🛡️',
    title: 'Rol Bazlı Yetkilendirme, İki Adımlı Doğrulama ve Denetim Kaydı | OIDS',
    description:
      'Menü bazında görme/ekleme/düzenleme/silme yetkisi, doğrulayıcı uygulama ile iki adımlı giriş, SMS ile giriş, değiştirilemez denetim kayıtları.',
    lead:
      'Kim neyi görür, kim neyi değiştirir; menü bazında siz belirleyin. Yapılan her işlem silinemez denetim kaydına yazılır.',
    features: [
      ['Rol grupları', 'Her menü için görme, ekleme, düzenleme ve silme yetkisi ayrı verilir.'],
      ['Personelden kullanıcı', 'Kullanıcı hesapları personel listesinden oluşturulur.'],
      ['Menü düzeni', 'Okulunuza özel menü sırası ve grupları.'],
      ['İki adımlı doğrulama', 'Google Authenticator gibi doğrulayıcı uygulamalarla (QR kod) giriş.'],
      ['SMS ile giriş', 'Günlük limitli SMS doğrulama kodu.'],
      ['Saldırı koruması', 'Görsel doğrulama (captcha) ve hatalı girişte IP’li geçici engel.'],
      ['Denetim kayıtları', 'Tüm işlemler kimin, ne zaman yaptığıyla birlikte; silinemez.'],
      ['Mobil kayıt onayı', 'Mobil uygulamadan gelen öğretmen kayıt isteklerini onaylayın veya gerekçeyle reddedin; 5651 kayıtları tutulur.'],
    ],
    related: ['yedekleme', 'is-takibi-ve-kurum-takvimi', 'mobil-uygulama'],
  },
  {
    slug: 'is-takibi-ve-kurum-takvimi',
    group: 'sistem',
    name: 'İş Takibi ve Kurum Takvimi',
    short: 'İş takibi ve takvim',
    icon: '✅',
    title: 'Okul İdaresi İş Takibi, Hatırlatmalar ve MEB Çalışma Takvimi | OIDS',
    description:
      'Periyodik idari işleri tanımlayın; son tarih yaklaşınca uygulama içi, SMS veya e-posta ile hatırlatılsın. MEB çalışma takvimi kurum takvimine hazır.',
    lead:
      'Her ay, her dönem tekrar eden idari işleri bir kez tanımlayın; OIDS zamanı gelince sorumlusuna hatırlatsın, geciken işleri işaretlesin.',
    features: [
      ['Periyodik işler', 'Bir sonraki son tarih otomatik hesaplanır; işi duraklatın veya sürdürün.'],
      ['Zorunlu iş işareti', 'Atlanmaması gereken işleri öne çıkarın.'],
      ['Hatırlatma kanalları', 'Uygulama içi bildirim, SMS veya e-posta.'],
      ['Gecikme uyarıları', 'Süresi geçen işler otomatik bildirilir.'],
      ['Kurum takvimi', 'İş son tarihleri ve hazır 2026-2027 MEB çalışma takvimi.'],
      ['Gönderim kayıtları', 'Giden tüm SMS ve e-postalar kayıt altında.'],
    ],
    related: ['yetkilendirme-ve-guvenlik', 'ogretmen-evrak-arsivi', 'veli-iletisim'],
  },
  {
    slug: 'e-okul-eklentisi',
    group: 'sistem',
    name: 'e-Okul Tarayıcı Eklentisi',
    short: 'e-Okul eklentisi',
    icon: '🧩',
    title: 'Ders Programını e-Okul’a Aktaran Tarayıcı Eklentisi | OIDS',
    description:
      'OIDS’te hazırlanan ders programını e-Okul ders programı ekranına otomatik dolduran tarayıcı eklentisi. MEBBİS şifrenizi istemez; kaydetmeyi siz yaparsınız.',
    lead:
      'Ders programını OIDS’te hazırlayın, e-Okul’a tek tek girmeyin. Eklenti, e-Okul’daki ders programı ekranını sizin yerinize doldurur.',
    features: [
      ['Programı doldurur', 'Yayınlanan programı “Kurum İşlemleri › Ders İşlemleri › Ders Programı” ekranına yerleştirir.'],
      ['Şifre istemez', 'Açık olan MEBBİS oturumunuzu kullanır; MEBBİS şifreniz eklentiye girilmez.'],
      ['Son söz sizde', 'Eklenti kaydet tuşuna basmaz; kontrol edip siz kaydedersiniz.'],
      ['Sınıfları e-Okul’dan alır', 'Şube listesini e-Okul’dan OIDS’e tek tıkla aktarır.'],
      ['Panelden indirme', 'Eklenti OIDS panelinden indirilir.'],
    ],
    related: ['otomatik-ders-programi', 'okul-ve-sinif-tanimlari', 'ogrenci-yonetimi'],
  },
  {
    slug: 'yedekleme',
    group: 'sistem',
    name: 'Yedekleme ve Veri Sürekliliği',
    short: 'Yedekleme',
    icon: '💾',
    title: 'Otomatik Yedekleme ve Şifreli Google Drive Kopyası | OIDS',
    description:
      'Veritabanı her gün otomatik yedeklenir, AES-256 ile şifrelenmiş kopyası Google Drive’a gönderilir. Saklama süresi, elle yedek ve onaylı geri yükleme.',
    lead:
      'Okulunuzun verisi her gece yedeklenir; şifrelenmiş bir kopyası ayrıca bulutta durur. Sunucuya bir şey olsa bile veri kaybolmaz.',
    features: [
      ['Günlük otomatik yedek', 'Belirlenen saklama süresi boyunca geçmiş yedekler tutulur.'],
      ['Şifreli bulut kopyası', 'AES-256-GCM ile şifrelenmiş kopya Google Drive’a gönderilir.'],
      ['Elle yedek ve indirme', 'İstendiğinde anında yedek alınır ve indirilir.'],
      ['Güvenli geri yükleme', 'Geri yükleme yanlışlıkla yapılamaz; onay kelimesi yazılması gerekir.'],
      ['Yedekleme geçmişi', 'Her yedekleme işlemi kayıt altında.'],
    ],
    related: ['yetkilendirme-ve-guvenlik', 'is-takibi-ve-kurum-takvimi', 'okul-ve-sinif-tanimlari'],
  },
]

export const MOBILE = {
  title: 'OIDS Mobil — Öğretmenler İçin Okul İdare Uygulaması (Android)',
  description:
    'OIDS mobil uygulamasıyla öğretmenler okul numarasıyla öğrenci arar, disiplin bildirimi gönderir, geçmiş bildirimlerini ve okul duyurularını takip eder.',
  features: [
    ['🔎', 'Öğrenci ara', 'Okul numarasını tuşlayın; öğrencinin fotoğrafı, sınıfı ve numarası anında gelsin.'],
    ['🚩', 'Bildirim oluştur', 'Hazır sebep etiketlerinden seçin, kendi etiketinizi ve notunuzu ekleyin. Bildirim doğrudan idarenin Disiplin ekranına düşer.'],
    ['🕘', 'Geçmiş bildirimlerim', 'Gönderdiğiniz tüm bildirimler ve durumları tek listede.'],
    ['🔔', 'Okul bildirimleri', 'İdarenin gönderdiği bildirimler zil simgesinde, okunmamış sayısıyla.'],
    ['🔐', 'Güvenli giriş', 'TC kimlik no ve şifre ile, görsel doğrulama korumalı. “Beni hatırla” bilgisi cihazın güvenli deposunda tutulur.'],
    ['🌙', 'Açık / koyu tema', 'Gözünüzü yormayan koyu tema bir dokunuşla.'],
  ],
  steps: [
    ['Uygulamayı yükleyin', 'Android telefonunuza “OIDS” uygulamasını yükleyin.'],
    ['Kayıt isteği gönderin', 'İl, ilçe ve okulunuzu seçin; TC kimlik no, ad soyad, cep telefonu ve e-posta ile kayıt isteği gönderin.'],
    ['İdare onaylasın', 'Okul idaresi isteğinizi panelden onaylar; TC kimlik no ve size iletilen şifreyle giriş yaparsınız.'],
  ],
  faq: [
    ['Mobil uygulamayı kimler kullanır?', 'Lisanslı okulların öğretmenleri. Öğrenci ve veliler için hesap açılmaz.'],
    ['iPhone sürümü var mı?', 'Uygulama şu an Android içindir.'],
    ['Uygulama hangi izinleri ister?', 'Konum, rehber, kamera veya reklam kimliği izni istenmez. Ayrıntılar gizlilik politikasındadır.'],
  ],
}

export const FAQ = [
  ['OIDS nedir?', 'OIDS (Okul İdare Sistemi), okul idaresinin ders programı, nöbet, sınav, disiplin, devamsızlık, ek ders, terfi, maaş bildirimi ve veli iletişimi gibi işlerini tek panelden yürüten web ve mobil yazılımdır.'],
  ['Hangi okul türleri için uygundur?', 'Ortaokullar, Anadolu liseleri ve meslek liseleri başta olmak üzere MEB’e bağlı okullar için tasarlanmıştır. İşletmede beceri eğitimi ve çok programlı şube adları gibi meslek lisesi ihtiyaçları da desteklenir.'],
  ['e-Okul ve MEBBİS verilerimi aktarabilir miyim?', 'Evet. e-Okul öğrenci ve fotoğraflı listeleri, MEBBİS personel listesi ve sorumlu ders listesi Excel olarak içe aktarılır. Sınıf listesi ve ders programı e-Okul ile tarayıcı eklentisi üzerinden aktarılır.'],
  ['Kurulum gerekiyor mu?', 'Hayır. OIDS tarayıcıdan çalışır; öğretmenler için Android uygulaması vardır. Sadece ders programını e-Okul’a aktarmak için isteğe bağlı bir tarayıcı eklentisi kullanılır.'],
  ['Verilerimiz güvende mi?', 'Rol bazlı yetkilendirme, iki adımlı doğrulama, silinemez denetim kayıtları, günlük otomatik yedek ve AES-256 ile şifrelenmiş bulut kopyası kullanılır. Yapay zekâ özelliklerine TC kimlik no veya telefon gönderilmez.'],
  ['Birden fazla okulu tek hesapla yönetebilir miyim?', 'Evet. Premium planda tek hesapla en fazla 3 okul yönetilir.'],
  ['SMS gönderimi nasıl ücretlendirilir?', 'SMS, 3.000 veya 10.000 kontörlük ek paketlerle kullanılır. Veli duyuruları, iş hatırlatmaları ve SMS ile giriş bu kotadan düşer.'],
  ['Demo nasıl alırım?', 'info@oids.com.tr adresine okulunuzun adıyla yazın; modülleri birlikte inceleyelim.'],
]
