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

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function tableHeaderRow(cells) {
  return new TableRow({
    children: cells.map((text) =>
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
    children: cells.map((text) =>
      new TableCell({
        borders: cellBorders,
        children: [new Paragraph({ text })],
      })
    ),
  });
}

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: 'Lise İdari Yönetim Sistemi', bold: true, size: 36 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: 'Proje Yöneticisi Bilgilendirme Dökümanı',
              size: 28,
              color: '444444',
            }),
          ],
        }),
        para('Versiyon: 1.0.0', { italics: true }),
        para('Tarih: 31 Ağustos 2026', { italics: true }),
        para(
          'Bu döküman, teknik detaylara girmeden projenin amacını, kapsamını ve iş değerini özetlemek için hazırlanmıştır.',
          { italics: true, color: '666666' }
        ),

        heading('1. Bu Proje Nedir?'),
        para(
          'Lise İdari Yönetim Sistemi, liselerin günlük idari işlerini dijital ortamda takip etmek ve yönetmek için geliştirilen bir yazılım altyapısıdır. Okul müdürü, müdür yardımcısı, memur ve öğretmenlerin ihtiyaç duyduğu temel bilgiler — okul kayıtları, personel bilgileri, kullanıcı hesapları — tek bir merkezden yönetilebilir.'
        ),
        para(
          'Sistem şu an bir web veya mobil uygulama olarak son kullanıcıya sunulmuyor; bunun yerine arka planda çalışan ve ileride eklenecek arayüzlerin bağlanacağı güvenli bir veri ve işlem merkezi (backend) olarak tasarlandı. Yani projenin bugünkü çıktısı, okul idaresinin dijital dönüşümüne hazır bir temel altyapıdır.'
        ),

        heading('2. Neden Bu Projeye İhtiyaç Var?'),
        para(
          'Okul idarelerinde personel kayıtları, yetki dağılımı ve okul bilgileri çoğu zaman dağınık dosyalar, e-tablo veya manuel süreçlerle tutuluyor. Bu durum hem zaman kaybına hem de hata riskine yol açıyor. Aynı kurumda farklı kişilerin farklı yetkilerle çalışması gerektiğinde kim neyi görebilir, kim neyi değiştirebilir sorusu net yanıt bulmakta zorlanıyor.'
        ),
        para(
          'Bu proje, okul idari süreçlerini standartlaştırmak, yetkileri net tanımlamak ve birden fazla okulun aynı sistem üzerinde güvenli şekilde yönetilmesini mümkün kılmak için başlatıldı.'
        ),

        heading('3. Kimler Faydalanacak?'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeaderRow(['Kullanıcı Grubu', 'Beklenen Fayda']),
            tableRow([
              'Okul Müdürü',
              'Tüm okul ve personel bilgilerine erişim; yetki ve kullanıcı yönetiminin merkezi kontrolü',
            ]),
            tableRow([
              'Müdür Yardımcısı',
              'Öğretmen ve kullanıcı kayıtlarını yönetme; okul bilgilerini görüntüleme',
            ]),
            tableRow([
              'Memur / İdari Personel',
              'Günlük kayıt ve güncelleme işlerini hızlı ve tutarlı şekilde yapma',
            ]),
            tableRow([
              'Öğretmen',
              'İlgili bilgilere güvenli erişim (okuma); gereksiz idari yükün azalması',
            ]),
            tableRow([
              'Kurum / İl Düzeyi Yönetim',
              'Birden fazla okulu tek altyapıda izole ve güvenli şekilde yönetme',
            ]),
          ],
        }),

        heading('4. Sistem Bugün Ne Yapabiliyor?'),
        para('Mevcut sürümde (v1.0.0) aşağıdaki işlevler hazır durumda:'),

        bullet('Kullanıcı hesabı oluşturma ve sisteme giriş yapma'),
        bullet('Okul bilgilerinin kaydedilmesi, güncellenmesi ve listelenmesi'),
        bullet('Öğretmen kayıtlarının oluşturulması ve yönetilmesi'),
        bullet('Kullanıcı hesaplarının yönetimi (oluşturma, güncelleme, silme)'),
        bullet('Her kişiye rol atama: Müdür, Müdür Yardımcısı, Memur, Öğretmen'),
        bullet('Rol bazlı yetkilendirme — herkes yalnızca görevine uygun işlemleri yapabilir'),
        bullet('Birden fazla kurumun (tenant) aynı sistemde, verileri birbirine karışmadan çalışması'),

        para(
          'Özetle: Okul idaresinin temel “kayıt ve yetki” ihtiyaçları için çalışan bir çekirdek tamamlandı. Henüz görsel bir kullanıcı arayüzü (web sitesi veya uygulama) bu projeye bağlı değil; altyapı hazır, arayüz eklendiğinde doğrudan kullanılabilir.',
          { italics: true }
        ),

        heading('5. Roller ve Yetkiler (Basit Açıklama)'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeaderRow(['Rol', 'Ne Yapabilir?']),
            tableRow([
              'Müdür',
              'Her şeyi görebilir ve yönetebilir: okul, kullanıcı ve öğretmen kayıtları',
            ]),
            tableRow([
              'Müdür Yardımcısı',
              'Öğretmen ve kullanıcıları yönetebilir; okul bilgilerini görebilir',
            ]),
            tableRow([
              'Memur',
              'Öğretmen kayıtlarını ekleyebilir ve güncelleyebilir; diğer bilgileri görebilir',
            ]),
            tableRow([
              'Öğretmen',
              'Yalnızca bilgileri görüntüleyebilir; kayıt ekleme veya silme yapamaz',
            ]),
          ],
        }),

        heading('6. Proje Kapsamı'),
        new Paragraph({ text: 'Kapsam İçinde (Tamamlanan / Mevcut)', heading: HeadingLevel.HEADING_3 }),
        bullet('Kullanıcı girişi ve hesap yönetimi'),
        bullet('Okul yönetimi'),
        bullet('Öğretmen yönetimi'),
        bullet('Rol ve yetki sistemi'),
        bullet('Çoklu kurum (tenant) desteği'),
        bullet('Güvenli veri saklama ve erişim kontrolü'),

        new Paragraph({ text: 'Kapsam Dışında (Henüz Yapılmadı)', heading: HeadingLevel.HEADING_3 }),
        bullet('Web veya mobil kullanıcı arayüzü'),
        bullet('Öğrenci kayıt ve takip modülü'),
        bullet('Ders programı, devamsızlık, not sistemi'),
        bullet('Raporlama ve dashboard ekranları'),
        bullet('E-posta bildirimleri ve otomatik hatırlatmalar'),

        heading('7. İş Değeri ve Beklenen Faydalar'),
        bullet('Zaman tasarrufu: Manuel kayıt ve dosya takibine harcanan sürenin azalması'),
        bullet('Hata azaltma: Merkezi kayıt sistemiyle tutarsız ve eksik verinin önlenmesi'),
        bullet('Güvenlik ve denetim: Kim hangi bilgiye erişti, kimin hangi yetkisi var — net tanım'),
        bullet('Ölçeklenebilirlik: Yeni okul veya kurum eklendiğinde aynı altyapı kullanılabilir'),
        bullet('Dijital dönüşüm hazırlığı: İleride eklenecek modüller için sağlam temel'),

        heading('8. Proje Durumu'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeaderRow(['Alan', 'Durum', 'Açıklama']),
            tableRow(['Çekirdek altyapı', 'Tamamlandı', 'Giriş, okul, öğretmen, kullanıcı yönetimi hazır']),
            tableRow(['Yetki sistemi', 'Tamamlandı', 'Dört rol ve izinler tanımlandı']),
            tableRow(['Kullanıcı arayüzü', 'Planlanıyor', 'Web veya mobil arayüz henüz yok']),
            tableRow(['Ek modüller', 'Planlanıyor', 'Öğrenci, ders, raporlama vb.']),
            tableRow(['Canlı ortam', 'Değerlendirme aşamasında', 'Kurulum ve yayına alma planlanmalı']),
          ],
        }),

        heading('9. Sonraki Adımlar (Önerilen Yol Haritası)'),
        bullet('Kısa vade: Kullanıcı arayüzü (web panel) geliştirilmesi ve bu altyapıya bağlanması'),
        bullet('Orta vade: Öğrenci kayıt modülü ve temel raporlama'),
        bullet('Uzun vade: Ders programı, devamsızlık, veli bildirimleri ve il düzeyi yönetim paneli'),
        para(
          'Bu adımların öncelik sırası ve zaman planı, kurumun ihtiyaçları ve kaynaklarına göre proje yönetimi ile birlikte netleştirilmelidir.',
          { italics: true }
        ),

        heading('10. Riskler ve Dikkat Edilecek Noktalar'),
        bullet(
          'Arayüz olmadan son kullanıcı doğrudan sistemi kullanamaz; altyapı hazır olsa da görünür bir ürün için arayüz şart'
        ),
        bullet(
          'Canlıya geçişte veri yedekleme, erişim politikaları ve kullanıcı eğitimi planlanmalı'
        ),
        bullet(
          'Birden fazla okul kullanılacaksa her kurumun veri izolasyonu ve yetki modeli önceden netleştirilmeli'
        ),
        bullet(
          'Mevcut manuel süreçlerden geçişte eski kayıtların sisteme aktarımı ayrı bir çalışma paketi gerektirebilir'
        ),

        heading('11. Özet'),
        para(
          'Lise İdari Yönetim Sistemi, okul idaresinin dijital dönüşümü için atılmış somut bir adımdır. Bugünkü çıktı, teknik altyapı ve temel idari modüllerin hazır olduğu bir “çekirdek sürüm”dür. Proje yöneticisi perspektifinden sistem, okul kayıtları, personel ve yetki yönetimini merkezileştirerek operasyonel verimlilik ve güvenlik hedeflerine hizmet eder; tam ürün deneyimi için kullanıcı arayüzü ve ek modüllerin planlanması bir sonraki aşamadır.'
        ),

        new Paragraph({
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: '— Lise İdari Yönetim Sistemi Proje Ekibi',
              italics: true,
              color: '666666',
            }),
          ],
        }),
      ],
    },
  ],
});

const outputPath = path.join(
  __dirname,
  '..',
  'docs',
  'Lise_Idari_Proje_Yoneticisi_Bilgilendirme.docx'
);

Packer.toBuffer(doc).then((buffer) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log('Döküman oluşturuldu:', outputPath);
});
