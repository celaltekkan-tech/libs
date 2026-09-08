const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} = require('docx');

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const cellBorders = {
  top: tableBorder,
  bottom: tableBorder,
  left: tableBorder,
  right: tableBorder,
};

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function para(text, options = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...options })],
  });
}

function labeled(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: value }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 40 } });
}

function tableHeaderRow(cells) {
  return new TableRow({
    tableHeader: true,
    children: cells.map(
      (text) =>
        new TableCell({
          borders: cellBorders,
          shading: { fill: 'E8E8E8' },
          children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        })
    ),
  });
}

function tableRow(cells) {
  return new TableRow({
    children: cells.map(
      (text) =>
        new TableCell({
          borders: cellBorders,
          children: [new Paragraph({ text })],
        })
    ),
  });
}

function table(rows) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

const modules = [
  {
    ad: 'Öğrenci İşleri Modülü',
    durum: 'Mevcut',
    amac:
      'Bu modül öğrenci işleri ile ilgilenen müdür yardımcılarının işlerini kolaylaştırmak için hazırlanmıştır. e-Okul’dan çekilecek öğrenci bilgileri istenilen tarzda ve istenilen dosya türüne uygun olarak sunulur. Örneğin üst yönetimden istenen Excel tablosunda ad-soyad tek sütunda isteniyorsa tek sütunda, ayrı sütunlarda isteniyorsa ayrı sütunlarda verilir. Buradaki en büyük kolaylık, e-Okul’dan tek seferde alınamayan bilgilerin tek seferde ve istenilen formatta çıkarılmasıdır.',
    islevler: [
      'e-Okul’dan alınan öğrenci verilerinin içe aktarılması ve tek havuzda birleştirilmesi',
      'İstenen alanların seçilerek özelleştirilebilir liste oluşturma (ad-soyad tek/ayrı sütun, T.C. no, sınıf, veli bilgisi vb.)',
      'Excel, PDF ve Word formatlarında dışa aktarma; şablon kaydedip sonraki taleplerde yeniden kullanma',
      'Sınıf, şube, cinsiyet, kayıt durumu ve özel durum (kaynaştırma, yabancı uyruklu vb.) bazlı filtreleme',
      'Nakil gelen/giden, kayıt-silme ve sınıf geçiş işlemlerinin takibi',
      'Öğrenci belgesi, öğrenim durum belgesi gibi standart evrak çıktıları',
      'Üst kuruma gönderilen periyodik cetvellerin hazır şablonlarla üretilmesi',
    ],
    kullanicilar: 'Öğrenci işlerinden sorumlu müdür yardımcısı, memur, okul müdürü',
    ciktilar: 'Özelleştirilebilir öğrenci listeleri, resmi yazı ekleri, istatistik cetvelleri',
    entegrasyon: 'e-Okul veri aktarımı (dosya bazlı içe aktarma), Excel/PDF/Word çıktı',
  },
  {
    ad: 'İhale, Okul Aile Birliği Alım Modülü',
    durum: 'Mevcut',
    amac:
      'Bu modül okulların alım işleri için hazırlanmıştır. Okullarımızın genel olarak kullandığı Excel çözümleri yerine daha derli toplu ve daha işlevsel bir yapı sunar.',
    islevler: [
      'Alım talebi oluşturma, onay akışı ve talep-teklif eşleştirme',
      'Teklif toplama, karşılaştırma tablosu ve en uygun teklifin belirlenmesi',
      'Piyasa fiyat araştırma tutanağı, muayene ve kabul komisyonu tutanağı, karar defteri kaydı gibi evrakların otomatik üretimi',
      'Komisyon üyelerinin ve görev dağılımının tanımlanması',
      'Fatura, ödeme ve teslim alma kayıtlarının takibi',
      'Doğrudan temin ve ihale sınır tutarlarının parametrik olarak tanımlanması',
      'Yıllık alım özeti ve harcama kalemlerine göre raporlama',
    ],
    kullanicilar: 'Okul müdürü, müdür yardımcısı, Okul Aile Birliği yönetimi, memur',
    ciktilar: 'Teklif karşılaştırma tablosu, komisyon tutanakları, harcama raporları',
    entegrasyon: 'Bütçe/TEFBİS modülü, taşınır mal (ayniyat) modülü',
  },
  {
    ad: 'Personel İşleri Modülü',
    durum: 'Mevcut',
    amac:
      'Okul personeli ile ilgili norm, terfi, devamsızlık, maaş değişikliği ve yer değişikliği evraklarının düzenlenmesini kapsayan modüldür.',
    islevler: [
      'Personel özlük kartı (kimlik, branş, kadro, hizmet süresi, iletişim bilgileri)',
      'Norm kadro takibi; boş ve dolu norm durumunun izlenmesi',
      'Terfi, kademe ve derece ilerlemesi tarihlerinin takibi ve önceden uyarı',
      'İzin (yıllık, mazeret, rapor, ücretsiz) kayıtları ve kalan izin hesabı',
      'Görevlendirme, yer değiştirme, başlama ve ayrılma evraklarının hazırlanması',
      'Rapor, izin ve görevden ayrılma kaynaklı maaş değişikliği bildirimlerinin üretilmesi',
      'Hizmet içi eğitim ve belge takibi',
      'Personel bazlı dijital evrak arşivi',
    ],
    kullanicilar: 'Personel işlerinden sorumlu müdür yardımcısı, memur, okul müdürü',
    ciktilar: 'Özlük dosyası çıktıları, norm cetveli, izin ve terfi listeleri, maaş değişikliği bildirimleri',
    entegrasyon: 'MEBBİS verileriyle uyumlu içe aktarma, ek ders ve puantaj modülü',
  },
  {
    ad: 'Dönüşümlü Nöbet Programı Modülü',
    durum: 'Mevcut',
    amac:
      'Okullarımızda uygulanan dönüşümlü nöbette her öğretmene adil dağılım yapmaya yarayan bu modül, muadillerinin aksine haftalık veya aylık dönüşüm, ikili öğretim için ikili dönüşüm sistemleri ve kat değişimleri sunar.',
    islevler: [
      'Öğretmen sayısı, ders programı ve boş saatlere göre otomatik nöbet ataması',
      'Haftalık, aylık ve ikili öğretimde ikili dönüşüm seçenekleri',
      'Kat, koridor, bahçe, kantin gibi nöbet yerlerinin tanımlanması ve dönüşümlü dağıtımı',
      'Adalet kontrolü: kişi başına düşen nöbet sayısı ve nöbet yeri dengesi raporu',
      'İzin veya rapor durumunda otomatik yedek atama ve nöbet devri',
      'Nöbet defteri, nöbet çizelgesi ve panoya asılacak liste çıktıları',
      'Nöbet tutanağı ve olay kaydı girişi',
    ],
    kullanicilar: 'Müdür yardımcısı, öğretmenler (görüntüleme), okul müdürü',
    ciktilar: 'Haftalık/aylık nöbet çizelgesi, nöbet defteri, dağılım denge raporu',
    entegrasyon: 'Ders programı modülü, personel işleri modülü, ek ders modülü',
  },
  {
    ad: 'Sınav Programı Hazırlama Modülü',
    durum: 'Mevcut',
    amac:
      'Okul sınavlarının veya sorumluluk sınavlarının zorluk derecesine göre planlanmasını sağlayan modüldür.',
    islevler: [
      'Ders zorluk derecesi ve öğrenci yükü dikkate alınarak sınav takvimi oluşturma',
      'Aynı gün içinde çakışan veya ardışık zor ders sınavlarının engellenmesi',
      'Ortak sınav, telafi sınavı ve sorumluluk sınavı planlaması',
      'Salon, oturma düzeni ve gözetmen ihtiyacının hesaplanması',
      'Sınav takviminin öğrenci, veli ve öğretmenlere duyurulması',
      'Tarih değişikliklerinin tek noktadan güncellenmesi ve ilgililere bildirilmesi',
    ],
    kullanicilar: 'Müdür yardımcısı, zümre başkanları, öğretmenler',
    ciktilar: 'Sınav takvimi, salon ve gözetmen listeleri, duyuru metinleri',
    entegrasyon: 'Kelebek sistemi, ders programı modülü, veli iletişim modülü',
  },
  {
    ad: 'Muhakkiklik Modülü',
    durum: 'Mevcut',
    amac:
      'Muhakkiklik dosyası hazırlama, bilgilerin ve evrakların sıralamasını doğru yapma konusunda yardımcı olan modüldür. Web tabanlı çalıştığı için görevlendirme yapılan her okuldan erişilebilir.',
    islevler: [
      'Soruşturma dosyası açma; konu, taraflar ve görevlendirme bilgilerinin kaydı',
      'Mevzuata uygun evrak sıralaması ve eksik evrak kontrol listesi',
      'İfade tutanağı, görevlendirme yazısı, savunma istem yazısı gibi şablonların üretimi',
      'Süre takibi (savunma süresi, rapor teslim tarihi) ve hatırlatma bildirimleri',
      'Soruşturma raporu ve teklif bölümünün şablonla hazırlanması',
      'Dosyanın tek PDF hâlinde, sıralı biçimde çıktı alınması',
      'Gizlilik dereceli erişim; dosyaya yalnızca görevli muhakkikin ulaşabilmesi',
    ],
    kullanicilar: 'Muhakkik olarak görevlendirilen yönetici veya öğretmen',
    ciktilar: 'Tam ve sıralı soruşturma dosyası, soruşturma raporu',
    entegrasyon: 'Evrak ve arşiv modülü; KVKK uyumlu erişim kısıtı',
  },
  {
    ad: 'Disiplin Modülü',
    durum: 'Mevcut',
    amac:
      'Okul öğrenci disiplin işlemlerinin düzenli yürümesi, evrakların eksiksiz hazırlanması ve öğrencilerin disiplin takibinin yapılması ile ilgili modüldür.',
    islevler: [
      'Olay bildirimi ve disiplin dosyası açma',
      'Öğrenci bazlı disiplin geçmişi ve tekrar eden davranışların izlenmesi',
      'Onur kurulu ve disiplin kurulu üyeleri, toplantı ve karar kayıtları',
      'Mevzuata uygun ceza kademeleri ve önerilen yaptırım rehberi',
      'Veli tebligatı, savunma istemi ve karar bildirim evraklarının üretimi',
      'Süre ve itiraz takibi',
      'Dönemlik disiplin istatistikleri ve önleyici çalışma raporları',
    ],
    kullanicilar: 'Müdür yardımcısı, kurul üyeleri, rehber öğretmen, okul müdürü',
    ciktilar: 'Disiplin dosyası, kurul kararı, veli tebligatı, istatistik raporu',
    entegrasyon: 'Öğrenci işleri, rehberlik ve veli iletişim modülleri',
  },
  {
    ad: 'Devamsızlık ve DYK Kurs Takip Modülü',
    durum: 'Mevcut (adı netleştirildi)',
    amac:
      'Devamsızlık takibi sonucunda velilere SMS gönderilmesini ve devam şartı sağlanmadığı için kapatılması gereken kursların bildirilmesini sağlayan modüldür.',
    islevler: [
      'Günlük devamsızlık girişinin toplanması ve e-Okul verisiyle karşılaştırılması',
      'Devamsızlık eşiklerine (10, 20, 30 gün vb.) ulaşan öğrenciler için otomatik uyarı',
      'Velilere SMS veya e-posta ile otomatik bilgilendirme ve gönderim geçmişi',
      'Devamsızlık ihtar yazılarının üretimi',
      'DYK kurslarında öğrenci devam durumunun izlenmesi',
      'Devam şartını sağlamayan ve kapatılması gereken kursların bildirimi',
      'Kurs, öğretmen ve öğrenci bazlı devam raporları',
    ],
    kullanicilar: 'Müdür yardımcısı, memur, DYK sorumlusu, rehberlik servisi',
    ciktilar: 'Devamsızlık raporları, ihtar yazıları, SMS gönderim kayıtları, kurs devam listeleri',
    entegrasyon: 'e-Okul, veli iletişim modülü, SMS servis sağlayıcısı',
  },
  {
    ad: 'Kelebek Sistemi (Sınav Salon ve Oturma Planı) Modülü',
    durum: 'Mevcut',
    amac: 'Sınavlarda kullanılmak üzere kelebek sınav (karışık oturma) düzeni oluşturan modüldür.',
    islevler: [
      'Sınıf ve şubeleri karıştırarak kelebek oturma düzeninin otomatik oluşturulması',
      'Kopya riskini azaltacak şekilde aynı sınıftan öğrencilerin ayrıştırılması',
      'Salon kapasitesi ve sıra düzenine göre yerleşim',
      'Salon kapı listesi, sıra etiketi ve öğrenci yerleşim krokisi çıktıları',
      'Gözetmen ve görevli ataması ile görev yazılarının üretimi',
      'Sınav sonrası salon bazlı yoklama ve katılım listesi',
    ],
    kullanicilar: 'Müdür yardımcısı, sınav komisyonu, gözetmen öğretmenler',
    ciktilar: 'Salon listeleri, oturma krokisi, sıra etiketleri, gözetmen görev listesi',
    entegrasyon: 'Sınav programı hazırlama modülü, öğrenci işleri modülü',
  },
  {
    ad: 'Rehberlik Modülü',
    durum: 'Mevcut',
    amac:
      'Rehber öğretmenlerimizin kullanacağı evraklar, destek eğitimi ve evde eğitim evrakları, disiplin raporları, danışmanlık tedbiri raporları ve benzeri belgeleri kapsayan modüldür.',
    islevler: [
      'Öğrenci görüşme kayıtları ve gizlilik dereceli erişim',
      'Destek eğitim odası, evde eğitim ve BEP evraklarının hazırlanması',
      'Danışmanlık tedbiri ve adli süreç raporları',
      'Risk takibi ile RAM, sağlık kuruluşu ve sosyal hizmetlere yönlendirme kayıtları',
      'Grup rehberliği, seminer ve veli çalışması planlaması',
      'Yıllık çerçeve plan ve dönemlik rehberlik faaliyet raporu',
    ],
    kullanicilar: 'Rehber öğretmenler, müdür yardımcısı (sınırlı erişim), okul müdürü (özet)',
    ciktilar: 'Görüşme formları, BEP ve destek eğitim evrakları, faaliyet raporları',
    entegrasyon: 'Öğrenci işleri, disiplin ve devamsızlık modülleri; KVKK gizlilik kuralları',
  },
  {
    ad: 'Öğretmen Modülü',
    durum: 'Mevcut',
    amac:
      'Öğretmenlerin sene içerisinde ihtiyaç duyduğu evrakları düzenleyebilecekleri modüldür (yıllık planlar, zümre tutanakları, sınıf rehberlik veya kulüp faaliyet raporları, Maarif Modeli etkinlik raporları, öğrenci gelişim raporları vb.).',
    islevler: [
      'Yıllık ders planı ve ünitelendirilmiş plan hazırlama; şablon kütüphanesi',
      'Zümre toplantı tutanakları ve karar kayıtları',
      'Sınıf rehberlik planı, kulüp ve toplum hizmeti faaliyet raporları',
      'Maarif Modeli etkinlik ve değer-eylem çerçevesi raporları',
      'Öğrenci gelişim ve gözlem raporları',
      'Öğretmene özel dijital evrak arşivi ve önceki yıl planlarını kopyalayarak güncelleme',
      'Yöneticiye teslim edilen evrakların durum takibi (teslim edildi / onaylandı / revizyon istendi)',
    ],
    kullanicilar: 'Öğretmenler, zümre başkanları, müdür yardımcısı',
    ciktilar: 'Yıllık planlar, tutanaklar, faaliyet ve gelişim raporları',
    entegrasyon: 'Ders programı modülü, kurul ve zümre modülü',
  },
  {
    ad: 'İşçi-TYP Takip ve Puantaj Modülü',
    durum: 'Mevcut',
    amac:
      'İşçilerin ve TYP personelinin imza ve devam-devamsızlık durumlarını takip ederek puantajlarını hazırlamaya yarayan modüldür.',
    islevler: [
      'İşçi ve TYP personelinin künye ve sözleşme bilgilerinin kaydı',
      'Günlük imza/devam çizelgesi ve devamsızlık girişi',
      'İzin, rapor ve fazla mesai kayıtları',
      'Aylık puantaj tablosunun otomatik oluşturulması',
      'Puantaj çıktısının imzaya hazır resmi formatta üretilmesi',
      'Personel bazlı devam istatistikleri ve geçmiş ay karşılaştırması',
    ],
    kullanicilar: 'Müdür yardımcısı, memur, okul müdürü',
    ciktilar: 'İmza çizelgesi, aylık puantaj cetveli, devam raporu',
    entegrasyon: 'Personel işleri modülü, bütçe ve muhasebe modülü',
  },
  {
    ad: 'Pansiyon İşleri Modülü',
    durum: 'Mevcut',
    amac:
      'Aylık belletici nöbeti hazırlama, kalori hesaplı aylık yemek tablosu oluşturma, ücretli yemek takibi ve listesi hazırlama işlemlerini kapsayan modüldür.',
    islevler: [
      'Aylık belletici öğretmen nöbet çizelgesinin adil dağılımla oluşturulması',
      'Hafta içi, hafta sonu ve gece nöbeti ayrımının yapılması',
      'Kalori hesaplı aylık yemek listesi hazırlama',
      'Parasız yatılı ve paralı yatılı öğrenci takibi ile ücret tahsilat listesi',
      'Öğrenci giriş-çıkış, izin ve veliye teslim kayıtları',
      'Ambar istihkakı ve günlük yemek tabelasının hazırlanması',
      'Oda ve yatak yerleşim planı',
    ],
    kullanicilar: 'Pansiyondan sorumlu müdür yardımcısı, belletici öğretmenler, ambar memuru',
    ciktilar: 'Belletici nöbet çizelgesi, yemek listesi ve günlük tabela, ücret ve yerleşim listeleri',
    entegrasyon: 'Personel işleri, öğrenci işleri, satın alma ve taşınır mal modülleri',
  },

  // --- Önerilen (eksik tespit edilip eklenen) modüller ---
  {
    ad: 'Ek Ders ve Ücret Puantaj Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Öğretmen ek ders ücretleri okul idaresinin en sık tekrarlanan ve hata riski en yüksek işlemlerinden biridir. Mevcut listede yalnızca işçi-TYP puantajı yer alıyordu.',
    amac:
      'Öğretmenlerin aylık ek ders saatlerinin doğru hesaplanması, kesintilerin işlenmesi ve imzaya hazır ek ders çizelgesinin üretilmesi.',
    islevler: [
      'Haftalık ders yükü ve maaş karşılığı ders saatine göre ek ders hesabı',
      'Nöbet, DYK, egzersiz, sınav görevi, belletici ve hazırlık-planlama ek derslerinin ayrı ayrı işlenmesi',
      'İzin, rapor, görevlendirme ve resmî tatil kaynaklı kesintilerin otomatik düşülmesi',
      'Aylık ek ders çizelgesi ve onay/imza çıktısı',
      'MEBBİS ek ders girişine uygun döküm üretimi',
      'Geçmiş ay karşılaştırması, düzeltme (fark) kaydı ve gerekçe notu',
    ],
    kullanicilar: 'Müdür yardımcısı, memur, okul müdürü, öğretmen (kendi çizelgesini görüntüleme)',
    ciktilar: 'Aylık ek ders çizelgesi, kesinti listesi, MEBBİS uyumlu döküm',
    entegrasyon: 'Ders programı, nöbet, personel işleri ve devamsızlık modülleri',
  },
  {
    ad: 'Evrak, Yazı İşleri ve Arşiv Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Gelen-giden evrak kaydı ve arşiv, okul idaresinin temel işlerinden olmasına rağmen listede yer almıyordu. Ayrıca diğer tüm modüllerin ürettiği evrakın tek merkezde toplanması gerekir.',
    amac:
      'Okula gelen ve okuldan giden tüm evrakın kayıt altına alınması, standart dosya planına göre arşivlenmesi ve hızlı erişilebilir olması.',
    islevler: [
      'Gelen ve giden evrak kaydı, otomatik sayı verme',
      'Standart dosya planına göre sınıflandırma',
      'İmza ve paraf akışı ile evrak durumu takibi',
      'Tarama, dijital arşivleme ve içerikte arama',
      'Süreli evrakların takibi ve süre dolmadan hatırlatma',
      'DYS ile uyumlu üst yazı ve resmî yazışma şablonları',
      'Yıl sonu arşiv devir ve imha listeleri',
    ],
    kullanicilar: 'Memur, müdür yardımcısı, okul müdürü',
    ciktilar: 'Gelen-giden evrak defteri, üst yazılar, arşiv ve devir listeleri',
    entegrasyon: 'Tüm modüllerin ürettiği evraklar, DYS/MEBBİS format uyumu',
  },
  {
    ad: 'Taşınır Mal (Ayniyat) ve Depo Takip Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Satın alma modülü tanımlıyken alınan malzemenin kayda geçmesi, zimmetlenmesi ve sayımı için gerekli olan taşınır mal takibi eksikti.',
    amac:
      'Okulun demirbaş ve tüketim malzemelerinin mevzuata uygun şekilde kayıt altına alınması, zimmet ve sayım işlemlerinin yürütülmesi.',
    islevler: [
      'Taşınır İşlem Fişi (TİF) ile giriş ve çıkış kayıtları',
      'Zimmet takibi; oda, derslik ve kişi bazlı demirbaş listesi',
      'Sayım tutanağı ve kayıttan düşme teklif belgesi üretimi',
      'Tüketim malzemesi stok seviyesi ve kritik stok uyarısı',
      'Barkod ve etiket desteği',
      'Yıl sonu taşınır yönetim hesabı cetvellerinin hazırlanması',
    ],
    kullanicilar: 'Taşınır kayıt yetkilisi, memur, müdür yardımcısı, okul müdürü',
    ciktilar: 'TİF çıktıları, zimmet listeleri, sayım tutanakları, yıl sonu cetveller',
    entegrasyon: 'İhale/alım modülü, bakım-onarım modülü, bütçe ve muhasebe modülü',
  },
  {
    ad: 'Ders Dağıtım ve Haftalık Ders Programı Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Nöbet, sınav, ek ders ve öğretmen modüllerinin tamamı ders programı verisine dayanır. Bu veri kaynağı olmadan diğer modüller elle veri girişine mahkûm kalır.',
    amac:
      'Branş ve norm bazlı ders dağıtımının yapılması, çakışmasız haftalık ders programının oluşturulması.',
    islevler: [
      'Branş ve norm kadroya göre ders dağıtımı',
      'Öğretmen, sınıf ve derslik çakışma kontrolü',
      'Blok ders, atölye ve laboratuvar kısıtlarının tanımlanması',
      'Öğretmen uygunluk ve tercih saatlerinin dikkate alınması',
      'Otomatik program üretimi ve sonrasında manuel düzeltme imkânı',
      'Sınıf, öğretmen, derslik ve pano çıktıları',
    ],
    kullanicilar: 'Ders programından sorumlu müdür yardımcısı, okul müdürü, öğretmenler (görüntüleme)',
    ciktilar: 'Haftalık ders programı çizelgeleri, öğretmen ders yükü dökümü',
    entegrasyon: 'Personel işleri, nöbet, ek ders, sınav ve öğretmen modülleri',
  },
  {
    ad: 'Bütçe, Muhasebe ve TEFBİS Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Alım modülü mevcut olmasına rağmen Okul Aile Birliği gelir-gider takibi ve TEFBİS bildirimleri kapsam dışındaydı.',
    amac:
      'Okul ve Okul Aile Birliği gelir-giderlerinin şeffaf biçimde izlenmesi ve mevzuata uygun raporlanması.',
    islevler: [
      'Gelir-gider kayıtları; kasa ve banka hareketlerinin takibi',
      'Bağış, kantin kirası, etkinlik ve diğer gelir kalemlerinin izlenmesi',
      'Harcama belgesi ve fiş eşleştirme',
      'Aylık ve yıllık faaliyet raporu ile mizan çıktıları',
      'TEFBİS bildirimlerine uygun döküm üretimi',
      'Okul Aile Birliği genel kurul ve yönetim kurulu evrakları',
    ],
    kullanicilar: 'Okul müdürü, Okul Aile Birliği yönetimi, memur, denetim kurulu',
    ciktilar: 'Gelir-gider raporları, faaliyet raporu, TEFBİS dökümleri, kurul evrakları',
    entegrasyon: 'İhale/alım, kantin, taşınır mal ve puantaj modülleri',
  },
  {
    ad: 'Sosyal Etkinlik, Kulüp ve Yarışma Takip Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Kulüp faaliyet raporları öğretmen modülünde geçmesine rağmen kulüp kurulumu, yarışma ve gezi süreçleri için ayrı bir takip yapısı bulunmuyordu.',
    amac:
      'Sosyal etkinlik, kulüp çalışmaları ve yarışma süreçlerinin planlanması, izlenmesi ve belgelenmesi.',
    islevler: [
      'Kulüp kurulumu, danışman öğretmen ve öğrenci üye kayıtları',
      'Yıllık çalışma planı ve dönem sonu faaliyet raporu',
      'Belirli gün ve haftalar takvimi ile görevlendirme',
      'Yarışma ve proje (TÜBİTAK, eTwinning, sportif, kültürel) başvuru ve sonuç takibi',
      'Gezi planı, izin ve veli onay evrakları',
      'Etkinlik bütçesi, katılım ve başarı belgeleri',
    ],
    kullanicilar: 'Sosyal etkinliklerden sorumlu müdür yardımcısı, kulüp danışmanı öğretmenler',
    ciktilar: 'Kulüp planları, faaliyet raporları, gezi ve yarışma evrakları, katılım belgeleri',
    entegrasyon: 'Öğretmen modülü, öğrenci işleri, bütçe modülü',
  },
  {
    ad: 'Kantin, Yemekhane ve Servis (Taşımalı Eğitim) Takip Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Okulların dış hizmet alımıyla yürüttüğü kantin, yemekhane ve taşıma süreçleri denetim ve hakediş açısından ayrı bir takip gerektirir.',
    amac:
      'Okul içinde hizmet veren kantin, yemekhane ve servis işletmelerinin sözleşme, denetim ve hakediş süreçlerinin izlenmesi.',
    islevler: [
      'Kantin kira sözleşmesi, ödeme planı ve tahsilat takibi',
      'Kantin denetim formları ve hijyen kontrol kayıtları',
      'Yemekhane menü planı ve günlük öğün sayısı takibi',
      'Taşımalı eğitimde öğrenci-güzergâh eşleştirmesi',
      'Servis aracı, şoför ve rehber personel belge geçerlilik takibi',
      'Günlük taşıma ve yemek hakediş çizelgelerinin hazırlanması',
    ],
    kullanicilar: 'Müdür yardımcısı, memur, okul müdürü, denetim komisyonu',
    ciktilar: 'Denetim formları, hakediş çizelgeleri, güzergâh ve öğrenci listeleri',
    entegrasyon: 'Bütçe ve muhasebe modülü, öğrenci işleri modülü',
  },
  {
    ad: 'Bakım-Onarım ve Bina/Donanım Envanteri Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Okul binası, derslikler ve bilişim donanımının arıza-bakım süreçleri hiçbir modülde ele alınmamıştı.',
    amac:
      'Okulun fiziki ve teknolojik altyapısının envanterinin tutulması, arıza ve bakım süreçlerinin takip edilmesi.',
    islevler: [
      'Arıza ve talep bildirimi ile iş emri takibi',
      'Bina, derslik, laboratuvar ve atölye envanteri',
      'Bilişim donanımı (etkileşimli tahta, bilgisayar, yazıcı) garanti ve servis kaydı',
      'Periyodik bakım takvimi (asansör, kalorifer, yangın tüpü, elektrik tesisatı)',
      'Onarım maliyet takibi ve tedarikçi/firma kayıtları',
      'Tamamlanan iş raporları ve öncesi-sonrası kayıt',
    ],
    kullanicilar: 'Müdür yardımcısı, teknik personel, memur, okul müdürü',
    ciktilar: 'İş emri ve bakım raporları, envanter listeleri, maliyet dökümleri',
    entegrasyon: 'Taşınır mal modülü, ihale/alım modülü, bütçe modülü',
  },
  {
    ad: 'Sivil Savunma, İSG ve Tatbikat Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Sivil savunma planı, tatbikatlar ve iş sağlığı-güvenliği kayıtları mevzuat gereği zorunlu olmasına rağmen listede yoktu.',
    amac:
      'Okulun acil durum hazırlığının planlanması, tatbikatların belgelenmesi ve İSG yükümlülüklerinin takibi.',
    islevler: [
      'Sivil savunma planı ve görevli ekiplerin tanımlanması',
      'Tahliye, deprem ve yangın tatbikatı planı, tutanağı ve fotoğraf arşivi',
      'Risk değerlendirmesi ve acil durum eylem planı',
      'Yangın tüpü, ilk yardım dolabı ve acil çıkış kontrol çizelgeleri',
      'İSG eğitim kayıtları ile kaza ve olay bildirimleri',
      'Yıllık kontrol takvimi ve hatırlatmalar',
    ],
    kullanicilar: 'Sivil savunma amiri, müdür yardımcısı, okul müdürü, İSG sorumlusu',
    ciktilar: 'Tatbikat tutanakları, risk değerlendirme raporu, kontrol çizelgeleri',
    entegrasyon: 'Bakım-onarım modülü, personel işleri modülü',
  },
  {
    ad: 'Veli İletişim, Duyuru ve Bildirim Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'SMS bildirimi şu anda yalnızca devamsızlık modülünün içinde tanımlı. İletişim altyapısının ortak bir modüle taşınması, tüm modüllerin aynı yapıyı kullanmasını sağlar.',
    amac:
      'Veli ve personel ile yapılan tüm bilgilendirmelerin tek merkezden, kayıtlı ve izinli şekilde yürütülmesi.',
    islevler: [
      'Veli iletişim bilgilerinin güncel tutulması ve doğrulanması',
      'Toplu SMS ve e-posta gönderimi ile hazır mesaj şablonları',
      'Sınıf, şube veya kademe bazlı hedefli duyuru',
      'Veli toplantısı daveti ve katılım takibi',
      'Gönderim raporu, teslim durumu ve maliyet takibi',
      'KVKK aydınlatma metni ve açık rıza (izin) kaydı yönetimi',
    ],
    kullanicilar: 'Müdür yardımcısı, memur, rehberlik servisi, okul müdürü',
    ciktilar: 'Gönderim raporları, duyuru arşivi, katılım listeleri',
    entegrasyon: 'Devamsızlık, disiplin, sınav ve rehberlik modülleri; SMS/e-posta servis sağlayıcısı',
  },
  {
    ad: 'Kurul, Zümre ve Toplantı Yönetimi Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Zümre tutanakları öğretmen modülünde geçiyor; ancak öğretmenler kurulu, şube öğretmenler kurulu ve karar takibi için kurumsal bir yapı bulunmuyordu.',
    amac:
      'Okuldaki tüm kurul ve zümre toplantılarının planlanması, tutanaklarının tutulması ve alınan kararların takip edilmesi.',
    islevler: [
      'Öğretmenler kurulu, zümre ve şube öğretmenler kurulu takvimi',
      'Gündem oluşturma ve katılımcılara davet gönderme',
      'Tutanak hazırlama ve karar defteri kayıtları',
      'Alınan kararların sorumlusu, süresi ve gerçekleşme durumu takibi',
      'İmza ve katılım listeleri',
      'Geçmiş kararlar arasında arama ve raporlama',
    ],
    kullanicilar: 'Okul müdürü, müdür yardımcısı, zümre başkanları, öğretmenler',
    ciktilar: 'Toplantı tutanakları, karar defteri çıktısı, karar takip raporu',
    entegrasyon: 'Öğretmen modülü, evrak ve arşiv modülü',
  },
  {
    ad: 'Kütüphane ve Kitap Takip Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Okul kütüphanesi ve ders kitabı dağıtımı, öğrenci işleriyle doğrudan ilişkili olmasına rağmen kapsam dışındaydı.',
    amac: 'Okul kütüphanesindeki kitapların ve ders kitabı dağıtımının takip edilmesi.',
    islevler: [
      'Kitap künye kayıtları ve barkod ile etiketleme',
      'Ödünç verme, iade ve gecikme takibi',
      'Ders kitabı dağıtım ve sayım işlemleri',
      'Okuma istatistikleri ve en çok okunan kitaplar raporu',
      'Bağış kitap kaydı ve demirbaş eşleştirmesi',
    ],
    kullanicilar: 'Kütüphane sorumlusu öğretmen, öğrenciler (sorgulama), müdür yardımcısı',
    ciktilar: 'Ödünç listeleri, gecikme raporları, sayım ve dağıtım listeleri',
    entegrasyon: 'Öğrenci işleri modülü, taşınır mal modülü',
  },
  {
    ad: 'Raporlama ve Yönetici Paneli (Dashboard) Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Modüller tek tek rapor üretse de okul müdürünün bütünü tek ekranda görebileceği bir özet katmanı tanımlanmamıştı.',
    amac:
      'Okul yönetiminin karar almasını kolaylaştıracak özet göstergelerin ve periyodik raporların tek ekrandan sunulması.',
    islevler: [
      'Okul geneli özet göstergeler (öğrenci ve personel sayısı, devamsızlık, disiplin, bütçe durumu)',
      'Grafik ve trend gösterimleri',
      'Tarih, sınıf ve şube bazlı filtreleme',
      'Üst kuruma gönderilen periyodik cetvellerin tek adımda üretilmesi',
      'Excel ve PDF dışa aktarma',
      'Çok okullu yapıda okullar arası karşılaştırma',
    ],
    kullanicilar: 'Okul müdürü, müdür yardımcıları, kurum/il düzeyi yöneticiler',
    ciktilar: 'Yönetici özet panosu, periyodik cetveller, karşılaştırma raporları',
    entegrasyon: 'Tüm modüller (veri kaynağı olarak)',
  },
  {
    ad: 'Kullanıcı, Rol-Yetki ve Sistem Yönetimi Modülü',
    durum: 'Geliştirme başladı',
    gerekce:
      'Kullanıcı ve yetki yönetimi kaynak belgede yoktu; teknik altyapıda ise login, JWT ve rol-izin kontrolü ile geliştirmeye başlandı. Modül listesinde yer alması, her ekranın kime açık olacağının netleşmesi açısından gereklidir.',
    amac:
      'Sistemi kullanan kişilerin tanımlanması, yetkilerinin belirlenmesi ve sistemin güvenli biçimde yönetilmesi.',
    islevler: [
      'Kullanıcı hesabı açma, rol atama ve okul eşleştirme',
      'Giriş, oturum doğrulama (JWT) ve çıkış',
      'Modül bazlı yetkilendirme (görüntüleme, ekleme, güncelleme, silme)',
      'İşlem kayıtları (log) ve denetim izi',
      'Parola politikası ve oturum güvenliği ayarları',
      'Okul, dönem ve eğitim-öğretim yılı tanımları',
      'Veri yedekleme ve geri yükleme işlemleri',
    ],
    kullanicilar: 'Okul müdürü, sistem yöneticisi',
    ciktilar: 'Kullanıcı ve yetki listeleri, denetim izi raporları',
    entegrasyon: 'Tüm modüller',
  },
  {
    ad: 'Stratejik Plan, Okul Gelişim ve Kalite Takip Modülü',
    durum: 'Önerilen (eklendi)',
    gerekce:
      'Okulların hazırlamakla yükümlü olduğu stratejik plan ve gelişim planı izleme süreci listede bulunmuyordu.',
    amac:
      'Okulun stratejik hedeflerinin izlenmesi, gelişim planının takip edilmesi ve memnuniyet ölçümlerinin yapılması.',
    islevler: [
      'Stratejik plan hedef ve gösterge tanımları',
      'Dönemlik gerçekleşme girişi ve izleme-değerlendirme raporu',
      'Okul gelişim planı eylemlerinin sorumlu ve süre bazlı takibi',
      'Öğrenci, veli ve öğretmen memnuniyet anketlerinin uygulanması ve analizi',
      'Denetim ve rehberlik raporu bulgularının takibi',
    ],
    kullanicilar: 'Okul müdürü, stratejik plan ekibi, müdür yardımcıları',
    ciktilar: 'İzleme-değerlendirme raporları, anket analizleri, eylem takip listeleri',
    entegrasyon: 'Raporlama paneli, tüm modüllerin gösterge verileri',
  },
  {
    ad: 'Staj ve İşletmelerde Mesleki Eğitim Modülü',
    durum: 'Önerilen (opsiyonel)',
    gerekce:
      'Mesleki ve teknik Anadolu liselerinde staj takibi ayrı ve yoğun bir iş yüküdür. Genel liselerde kullanılmayacağı için opsiyonel modül olarak önerilmiştir.',
    amac:
      'İşletmelerde mesleki eğitim ve staj süreçlerinin öğrenci, işletme ve koordinatör öğretmen bazında yönetilmesi.',
    islevler: [
      'İşletme ve öğrenci eşleştirmesi ile sözleşme takibi',
      'Koordinatör öğretmen görevlendirmesi ve işletme ziyaret kayıtları',
      'Devam-devamsızlık girişi ve dönem puanlarının işlenmesi',
      'Öğrenci ücret ve sigorta bildirim listeleri',
      'İşletme değerlendirme formları ve dosya çıktıları',
    ],
    kullanicilar: 'Koordinatör müdür yardımcısı, koordinatör öğretmenler, memur',
    ciktilar: 'Sözleşmeler, ziyaret ve devam raporları, ücret/sigorta listeleri',
    entegrasyon: 'Öğrenci işleri, personel işleri ve ek ders modülleri',
  },
];

const mevcutSayisi = modules.filter((m) => m.durum.startsWith('Mevcut')).length;
const gelisimSayisi = modules.filter((m) => m.durum.startsWith('Geliştirme')).length;
const onerilenSayisi = modules.length - mevcutSayisi - gelisimSayisi;

function moduleSection(mod, index) {
  const children = [
    heading(`${index + 1}. ${mod.ad}`, HeadingLevel.HEADING_2),
    labeled('Durum', mod.durum),
  ];

  if (mod.gerekce) {
    children.push(labeled('Neden gerekli', mod.gerekce));
  }

  children.push(labeled('Amaç', mod.amac));
  children.push(para('Temel işlevler:', { bold: true }));
  mod.islevler.forEach((i) => children.push(bullet(i)));
  children.push(new Paragraph({ text: '', spacing: { after: 40 } }));
  children.push(labeled('Kullanıcılar', mod.kullanicilar));
  children.push(labeled('Çıktılar', mod.ciktilar));
  children.push(labeled('Entegrasyon', mod.entegrasyon));

  return children;
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'Okul İdare Programı', bold: true, size: 36 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: 'Modül Tanımları ve Kapsam Dökümanı', size: 28, color: '444444' }),
          ],
        }),
        labeled('Sürüm', '2.1 (tamamlanmış sürüm)'),
        labeled('Tarih', '8 Eylül 2026'),
        labeled('Kaynak belge', 'docs/gelen/Okul idare programı modülleri.docx'),
        labeled(
          'Kapsam',
          `${modules.length} modül (${mevcutSayisi} belgede tanımlı, ${gelisimSayisi} geliştirme başladı, ${onerilenSayisi} önerilen)`
        ),

        heading('1. Dökümanın Amacı'),
        para(
          'Bu döküman, okul idaresinin günlük işlerini dijital ortama taşıyacak olan Okul İdare Programı’nın hangi modüllerden oluşacağını, her modülün neyi çözdüğünü, kimin kullanacağını ve hangi çıktıları üreteceğini tanımlar. Kaynak belgede yalnızca modül başlıkları ve 1-2 cümlelik açıklamalar bulunuyordu; bu sürümde her modül standart bir yapıya kavuşturulmuş ve kapsam dışında kalan modüller tespit edilerek eklenmiştir.'
        ),
        para(
          'Döküman; proje yönetimi, geliştirme ekibi ve okul yöneticileri arasında ortak bir kapsam anlayışı oluşturmak için hazırlanmıştır. Yazılım tarafı backend (REST API) ve frontend (yönetici paneli) olarak birlikte geliştirilmektedir.'
        ),

        heading('2. Bu Sürümde Tamamlanan Eksikler'),
        para('İlk sürümdeki döküman incelendiğinde aşağıdaki eksikler tespit edilmiş ve giderilmiştir:'),
        bullet('Modül açıklamaları 1-2 cümleyle sınırlıydı; her modül için amaç, temel işlevler, kullanıcılar, çıktılar ve entegrasyon başlıkları eklendi.'),
        bullet('Modüllerin hangi rol tarafından kullanılacağı belirtilmemişti; kullanıcı grupları tanımlandı.'),
        bullet('Modüllerin birbiriyle ilişkisi yazılı değildi; entegrasyon bağlantıları eklendi.'),
        bullet('Okul idaresinin temel işlerinden olan ek ders puantajı, evrak/arşiv, taşınır mal, ders programı ve bütçe/TEFBİS gibi modüller listede yoktu; önerilen modüller olarak eklendi.'),
        bullet('Tüm modüllerde ortak olması gereken özellikler (yetkilendirme, çoklu okul, dışa aktarma, KVKK, arşivleme) tanımlanmamıştı; ayrı bir bölüm olarak yazıldı.'),
        bullet('e-Okul, MEBBİS/DYS, TEFBİS ve SMS gibi dış sistem entegrasyon ihtiyaçları belirtilmemişti; eklendi.'),
        bullet('Uygulama sırası ve öncelik bilgisi yoktu; fazlara ayrılmış bir yol haritası eklendi.'),
        bullet('Riskler, kısıtlar ve kısaltmalar sözlüğü bulunmuyordu; eklendi.'),
        bullet('“Devamsızlık Modülü DYK Kursu” gibi belirsiz başlıklar netleştirildi.'),

        heading('3. Kaynak Belge İncelemesi ve Yazılım Durumu'),
        para(
          '8 Eylül 2026 tarihinde gelen kaynak belge (docs/gelen/Okul idare programı modülleri.docx) 13 modül başlığı ve her biri için 1-2 cümlelik tanımdan oluşmaktadır. Belge, önceki taslakla aynı içeriği taşır; yeni bir modül eklenmemiştir. Eksikler bu sürümde yine tamamlanmıştır.'
        ),
        para('Kaynak belgedeki 13 modül:'),
        bullet('Öğrenci İşleri; İhale / Okul Aile Birliği Alım; Personel İşleri; Dönüşümlü Nöbet; Sınav Programı; Muhakkiklik; Disiplin; Devamsızlık ve DYK; Kelebek Sistemi; Rehberlik; Öğretmen; İşçi-TYP Puantaj; Pansiyon İşleri'),
        para(
          'Yazılımın bugünkü durumu, belge kapsamının gerisindedir. Tamamlanan iş, altyapı ve giriş katmanıdır; belgedeki idari modüller henüz ekran ve iş kuralı olarak kodlanmamıştır.'
        ),
        table([
          tableHeaderRow(['Katman', 'Durum', 'Açıklama']),
          tableRow([
            'Kimlik doğrulama ve giriş',
            'Geliştirme başladı',
            'Backend: login, /me, JWT, rol-izin; Frontend: login ekranı ve korumalı rota',
          ]),
          tableRow([
            'Kullanıcı, okul, öğretmen temel CRUD',
            'Altyapı var',
            'REST uçları hazır; belge modüllerinin tam iş kuralları henüz bağlanmadı',
          ]),
          tableRow([
            'Belgedeki 13 idari modül',
            'Planlandı, kodlanmadı',
            'Kapsam bu dökümanda netleştirildi; geliştirme yol haritasındaki fazlara göre yapılacak',
          ]),
          tableRow([
            'Önerilen ek 15 modül',
            'Kapsama eklendi',
            'Ek ders, evrak/arşiv, ders programı, TEFBİS vb. belgede yoktu',
          ]),
        ]),

        heading('4. Modül Listesi'),
        table([
          tableHeaderRow(['No', 'Modül', 'Durum']),
          ...modules.map((m, i) => tableRow([String(i + 1), m.ad, m.durum])),
        ]),
        para(
          '“Mevcut” belgenin ilk sürümünde tanımlı olanlardır. “Geliştirme başladı” kodda işe koyulmuş olandır. “Önerilen” kapsam incelemesiyle eklenenlerdir.',
          { italics: true }
        ),

        heading('5. Tüm Modüllerde Ortak Özellikler'),
        para(
          'Aşağıdaki özellikler tek tek modüllerde tekrar edilmemiş, tüm sistem için geçerli ortak gereksinimler olarak tanımlanmıştır:'
        ),
        bullet('Web tabanlı erişim: Kurulum gerektirmez, tarayıcı üzerinden çalışır; görevlendirme yapılan farklı okullardan da kullanılabilir.'),
        bullet('Çoklu okul/kurum desteği: Her okulun verisi birbirinden yalıtılmış şekilde saklanır.'),
        bullet('Rol ve yetki bazlı erişim: Müdür, müdür yardımcısı, memur, öğretmen ve rehber öğretmen için farklı yetki seviyeleri.'),
        bullet('Dışa aktarma: Excel, PDF ve Word formatlarında çıktı; kurum antetli şablon desteği.'),
        bullet('Şablon kütüphanesi: Sık kullanılan evrakların hazır şablonları ve önceki yıl verisini kopyalayarak güncelleme.'),
        bullet('Arama, filtreleme ve toplu işlem yapabilme.'),
        bullet('İşlem kayıtları: Hangi kaydı kimin ne zaman değiştirdiğinin izlenebilmesi.'),
        bullet('Eğitim-öğretim yılı bazlı arşivleme ve geçmiş yıl verilerine erişim.'),
        bullet('KVKK uyumu: Kişisel verilerde erişim kısıtı, gizlilik dereceleri, aydınlatma ve rıza kayıtları.'),
        bullet('Düzenli yedekleme ve veri güvenliği önlemleri.'),
        bullet('Mobil uyumlu görünüm.'),
        bullet('Ortak bildirim altyapısı: SMS, e-posta ve sistem içi bildirim.'),

        heading('6. Modül Tanımları'),
        para(
          'Her modül; durum, amaç, temel işlevler, kullanıcılar, çıktılar ve entegrasyon başlıkları altında tanımlanmıştır.'
        ),
        ...modules.flatMap((m, i) => moduleSection(m, i)),

        heading('7. Dış Sistem Entegrasyon İhtiyaçları'),
        table([
          tableHeaderRow(['Sistem', 'İhtiyaç', 'Yöntem']),
          tableRow([
            'e-Okul',
            'Öğrenci, devamsızlık ve sınıf verilerinin alınması',
            'Resmî API erişimi bulunmadığından, e-Okul’dan dışa aktarılan dosyaların içe alınması',
          ]),
          tableRow([
            'MEBBİS / DYS',
            'Personel verisi ve resmî yazışma formatı uyumu',
            'Format uyumlu döküm üretimi; manuel aktarım',
          ]),
          tableRow(['TEFBİS', 'Okul Aile Birliği gelir-gider bildirimleri', 'Bildirim formatına uygun rapor çıktısı']),
          tableRow(['SMS / E-posta servisi', 'Veli ve personel bilgilendirmeleri', 'Servis sağlayıcı entegrasyonu']),
          tableRow(['e-İmza / KEP', 'Evrak imza ve resmî gönderim (ileri aşama)', 'İleri aşamada değerlendirilecek']),
        ]),

        heading('8. Uygulama Yol Haritası'),
        para(
          'Modüller birbirine bağımlı olduğu için aşağıdaki sıralama önerilmektedir. Örneğin ders programı modülü tamamlanmadan nöbet ve ek ders modülleri tam verimle çalışamaz.'
        ),
        table([
          tableHeaderRow(['Faz', 'Modüller', 'Gerekçe']),
          tableRow([
            'Faz 1 — Temel',
            'Kullanıcı ve Yetki Yönetimi, Öğrenci İşleri, Personel İşleri, Ders Dağıtım ve Ders Programı',
            'Diğer tüm modüllerin beslendiği temel veri kaynakları',
          ]),
          tableRow([
            'Faz 2 — Günlük İşleyiş',
            'Dönüşümlü Nöbet, Ek Ders ve Puantaj, İşçi-TYP Puantaj, Devamsızlık ve DYK, Veli İletişim',
            'En sık tekrarlanan ve en çok zaman alan işler',
          ]),
          tableRow([
            'Faz 3 — Sınav ve Öğrenci Süreçleri',
            'Sınav Programı, Kelebek Sistemi, Disiplin, Rehberlik, Öğretmen Modülü',
            'Dönemsel yoğunluğu yüksek süreçler',
          ]),
          tableRow([
            'Faz 4 — Mali ve İdari Süreçler',
            'İhale/Alım, Bütçe-TEFBİS, Taşınır Mal, Evrak ve Arşiv, Muhakkiklik',
            'Mevzuat yükümlülüğü yüksek, denetime konu süreçler',
          ]),
          tableRow([
            'Faz 5 — Destek ve İhtiyaca Bağlı',
            'Pansiyon, Kantin-Yemekhane-Servis, Sosyal Etkinlik, Kütüphane, Bakım-Onarım, Sivil Savunma-İSG, Kurul ve Zümre, Stratejik Plan, Raporlama Paneli, Staj',
            'Okul türüne ve ihtiyaca göre devreye alınır',
          ]),
        ]),

        heading('9. Riskler ve Kısıtlar'),
        bullet('e-Okul ve MEBBİS için resmî entegrasyon izni bulunmaması; veri aktarımının dosya bazlı yapılması gerekliliği.'),
        bullet('Kişisel verilerin işlenmesinde KVKK ve MEB mevzuatına uyum zorunluluğu; özellikle rehberlik ve disiplin verilerinde gizlilik.'),
        bullet('Mevzuat değiştiğinde evrak şablonlarının ve iş kurallarının güncellenmesi ihtiyacı.'),
        bullet('Okullar arasında uygulama farklılıkları; modüllerin parametrik ve esnek tasarlanması gerekliliği.'),
        bullet('Kullanıcı eğitimi ve alışkanlık değişimi; mevcut Excel tabanlı çalışmadan geçiş süreci.'),
        bullet('Veri girişi doğruluğu; e-Okul ile sistem arasında tutarsızlık oluşma riski.'),
        bullet('Modül sayısının fazlalığı nedeniyle kapsamın kontrolsüz büyümesi; fazlara sadık kalınması önerilir.'),

        heading('10. Kısaltmalar'),
        table([
          tableHeaderRow(['Kısaltma', 'Açıklama']),
          tableRow(['BEP', 'Bireyselleştirilmiş Eğitim Programı']),
          tableRow(['DYK', 'Destekleme ve Yetiştirme Kursu']),
          tableRow(['DYS', 'Doküman Yönetim Sistemi']),
          tableRow(['İSG', 'İş Sağlığı ve Güvenliği']),
          tableRow(['Kelebek sistemi', 'Sınavlarda öğrencilerin sınıfları karıştırılarak yerleştirildiği oturma düzeni']),
          tableRow(['KVKK', 'Kişisel Verilerin Korunması Kanunu']),
          tableRow(['MEBBİS', 'Millî Eğitim Bakanlığı Bilişim Sistemleri']),
          tableRow(['OAB', 'Okul Aile Birliği']),
          tableRow(['RAM', 'Rehberlik ve Araştırma Merkezi']),
          tableRow(['TEFBİS', 'Türkiye’de Eğitimin Finansmanı ve Eğitim Harcamaları Bilgi Yönetim Sistemi']),
          tableRow(['TİF', 'Taşınır İşlem Fişi']),
          tableRow(['TYP', 'Toplum Yararına Program']),
        ]),

        new Paragraph({
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: '— Okul İdare Programı Proje Ekibi',
              italics: true,
              color: '666666',
            }),
          ],
        }),
      ],
    },
  ],
});

const outputDir = path.join(__dirname, '..', 'docs');
const fileName = 'Okul_Idare_Programi_Modulleri_Tamamlanmis.docx';
const outputs = [
  path.join(outputDir, fileName),
  path.join(outputDir, 'gelen', fileName),
];

Packer.toBuffer(doc).then((buffer) => {
  outputs.forEach((outputPath) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    console.log('Döküman oluşturuldu:', outputPath);
  });
  console.log(
    `Toplam modül: ${modules.length} (belgede ${mevcutSayisi}, geliştirme ${gelisimSayisi}, önerilen ${onerilenSayisi})`
  );
});
