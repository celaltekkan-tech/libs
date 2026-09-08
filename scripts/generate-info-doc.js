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
            new TextRun({ text: 'Lise İdari Backend', bold: true, size: 36 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: 'Proje Bilgilendirme Dökümanı', size: 28, color: '444444' }),
          ],
        }),
        para('Versiyon: 1.0.0', { italics: true }),
        para('Tarih: 31 Ağustos 2026', { italics: true }),

        heading('1. Proje Özeti'),
        para(
          'Lise İdari Backend, okulların idari işlerini dijital ortamda yönetmek amacıyla geliştirilmiş bir Node.js/Express tabanlı REST API backend projesidir. Sistem, birden fazla okul ve kurumun (tenant) aynı altyapı üzerinde güvenli ve izole şekilde çalışmasını destekler.'
        ),
        para(
          'Proje, öğretmen kayıtları, kullanıcı yönetimi, okul bilgileri ve rol tabanlı yetkilendirme gibi temel idari süreçleri merkezi bir API katmanı üzerinden sunmayı hedefler. Frontend uygulamaları veya üçüncü parti sistemler bu API\'ye bağlanarak okul idari operasyonlarını otomatikleştirebilir.'
        ),

        heading('2. Projenin Amacı'),
        bullet('Okul idari süreçlerinin (personel, kullanıcı, okul yönetimi) merkezi ve standart bir API üzerinden yönetilmesi'),
        bullet('Çoklu tenant (kiracı) mimarisi ile farklı kurumların verilerinin güvenli şekilde izole edilmesi'),
        bullet('Rol ve izin tabanlı erişim kontrolü (RBAC) ile yetki yönetiminin esnek ve güvenli yapılması'),
        bullet('JWT tabanlı kimlik doğrulama ile modern ve ölçeklenebilir bir güvenlik katmanı sağlanması'),
        bullet('PostgreSQL ve Sequelize ORM kullanımıyla güvenilir veri saklama ve migration tabanlı şema yönetimi'),
        bullet('Gelecekte genişletilebilir bir altyapı sunarak yeni modüllerin (öğrenci, ders, devamsızlık vb.) kolayca eklenebilmesi'),

        heading('3. Temel Özellikler'),
        bullet('Çoklu tenant (kiracı) desteği — Her kurum kendi veri alanında çalışır'),
        bullet('Kullanıcı yönetimi ve kimlik doğrulama (kayıt, giriş, JWT token)'),
        bullet('Okul yönetimi (CRUD işlemleri)'),
        bullet('Öğretmen yönetimi (CRUD işlemleri)'),
        bullet('Rol ve izin sistemi (RBAC) — Müdür, Müdür Yardımcısı, Memur, Öğretmen'),
        bullet('Hiyerarşik yapı: Tenant → Okul → Kullanıcı → Rol/İzin'),
        bullet('Joi ile istek validasyonu'),
        bullet('Merkezi hata yönetimi middleware\'i'),
        bullet('Health check endpoint (/health)'),

        heading('4. Teknoloji Yığını'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeaderRow(['Bileşen', 'Teknoloji', 'Açıklama']),
            tableRow(['Runtime', 'Node.js', 'Sunucu tarafı JavaScript çalışma ortamı']),
            tableRow(['Framework', 'Express.js', 'REST API web framework']),
            tableRow(['ORM', 'Sequelize', 'PostgreSQL veritabanı soyutlama katmanı']),
            tableRow(['Veritabanı', 'PostgreSQL', 'İlişkisel veritabanı']),
            tableRow(['Kimlik Doğrulama', 'JWT (jsonwebtoken)', 'Token tabanlı oturum yönetimi']),
            tableRow(['Şifreleme', 'bcrypt', 'Şifre hash\'leme']),
            tableRow(['Validasyon', 'Joi', 'İstek verisi doğrulama']),
            tableRow(['Migration', 'Sequelize CLI', 'Veritabanı şema yönetimi']),
            tableRow(['Geliştirme', 'nodemon', 'Otomatik sunucu yeniden başlatma']),
          ],
        }),

        heading('5. Sistem Mimarisi'),
        para('Proje katmanlı mimari prensibiyle yapılandırılmıştır:'),
        bullet('Routes — API endpoint tanımları ve middleware zinciri'),
        bullet('Controllers — İş mantığı ve istek/yanıt yönetimi'),
        bullet('Models — Sequelize veritabanı modelleri ve ilişkiler'),
        bullet('Middlewares — Kimlik doğrulama, yetkilendirme, validasyon, hata yakalama'),
        bullet('Validators — Joi şema tanımları'),
        bullet('Migrations & Seeders — Veritabanı şema ve başlangıç verisi yönetimi'),

        heading('6. Veritabanı Yapısı', HeadingLevel.HEADING_2),
        para('Sistem hiyerarşik bir veri modeli kullanır:'),
        para('Tenant (Kiracı) → School (Okul) → User (Kullanıcı) → UserSchool (Kullanıcı-Okul-Rol İlişkisi) → Role & Permission'),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeaderRow(['Tablo', 'Açıklama']),
            tableRow(['Tenants', 'Kiracı/kurum bilgileri']),
            tableRow(['Schools', 'Okul kayıtları']),
            tableRow(['Users', 'Sistem kullanıcıları']),
            tableRow(['Teachers', 'Öğretmen kayıtları']),
            tableRow(['roles', 'Rol tanımları (Müdür, Müdür Yardımcısı, Memur, Öğretmen)']),
            tableRow(['permissions', 'İzin tanımları (teachers.read, users.create vb.)']),
            tableRow(['role_permissions', 'Rol-İzin eşleştirmeleri']),
            tableRow(['users_schools', 'Kullanıcı-Okul-Rol ilişki tablosu']),
          ],
        }),

        heading('7. Rol ve İzin Sistemi', HeadingLevel.HEADING_2),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableHeaderRow(['Rol', 'Yetki Kapsamı']),
            tableRow(['Müdür', 'Tüm izinlere sahip (okul, kullanıcı, öğretmen — tam CRUD)']),
            tableRow(['Müdür Yardımcısı', 'Öğretmen ve kullanıcı yönetimi, okul okuma']),
            tableRow(['Memur', 'Öğretmen oluşturma/güncelleme, kullanıcı ve okul okuma']),
            tableRow(['Öğretmen', 'Sadece okuma izinleri (teachers, users, schools)']),
          ],
        }),

        para('İzin anahtarları:', { bold: true }),
        bullet('teachers.read, teachers.create, teachers.update, teachers.delete'),
        bullet('users.read, users.create, users.update, users.delete'),
        bullet('schools.read, schools.create, schools.update, schools.delete'),

        heading('8. API Endpoint\'leri', HeadingLevel.HEADING_2),
        new Paragraph({ text: 'Kimlik Doğrulama', heading: HeadingLevel.HEADING_3 }),
        bullet('POST /api/auth/register — Kullanıcı kaydı'),
        bullet('POST /api/auth/login — Kullanıcı girişi'),

        new Paragraph({ text: 'Kullanıcılar', heading: HeadingLevel.HEADING_3 }),
        bullet('GET /api/users — Kullanıcı listesi'),
        bullet('GET /api/users/:id — Kullanıcı detayı'),
        bullet('POST /api/users — Yeni kullanıcı oluştur'),
        bullet('PUT /api/users/:id — Kullanıcı güncelle'),
        bullet('DELETE /api/users/:id — Kullanıcı sil'),

        new Paragraph({ text: 'Okullar', heading: HeadingLevel.HEADING_3 }),
        bullet('GET /api/schools — Okul listesi'),
        bullet('GET /api/schools/:id — Okul detayı'),
        bullet('POST /api/schools — Yeni okul oluştur'),
        bullet('PUT /api/schools/:id — Okul güncelle'),
        bullet('DELETE /api/schools/:id — Okul sil'),

        new Paragraph({ text: 'Öğretmenler', heading: HeadingLevel.HEADING_3 }),
        bullet('GET /api/teachers — Öğretmen listesi'),
        bullet('GET /api/teachers/:id — Öğretmen detayı'),
        bullet('POST /api/teachers — Yeni öğretmen oluştur'),
        bullet('PUT /api/teachers/:id — Öğretmen güncelle'),
        bullet('DELETE /api/teachers/:id — Öğretmen sil'),

        para('Not: Kimlik doğrulama gerektiren endpoint\'lerde Authorization: Bearer <token> header\'ı kullanılmalıdır.', { italics: true }),

        heading('9. Güvenlik'),
        bullet('Şifreler bcrypt ile hash\'lenerek saklanır'),
        bullet('JWT token\'lar ile kimlik doğrulama yapılır'),
        bullet('Tenant izolasyonu — Her kullanıcı yalnızca kendi tenant\'ındaki verilere erişebilir'),
        bullet('Rol ve izin bazlı yetkilendirme (RBAC) middleware\'i'),
        bullet('Joi validasyonu ile girdi doğrulama'),

        heading('10. Kurulum ve Çalıştırma'),
        bullet('npm install — Bağımlılıkları yükle'),
        bullet('.env dosyası oluştur (DB_USER, DB_PASS, DB_NAME, JWT_SECRET vb.)'),
        bullet('npm run migrate — Veritabanı migration\'larını çalıştır'),
        bullet('npm run seed — Rol ve izin seed verilerini yükle'),
        bullet('npm run dev — Geliştirme modunda çalıştır (nodemon)'),
        bullet('npm start — Production modunda çalıştır'),

        heading('11. Gelecek Geliştirme Planları'),
        bullet('Frontend uygulaması entegrasyonu'),
        bullet('Tenants API endpoint\'lerinin genişletilmesi'),
        bullet('Pagination desteği (büyük veri setleri için)'),
        bullet('Audit/logging ve soft delete (paranoid) özellikleri'),
        bullet('Öğrenci, ders, devamsızlık gibi yeni modüllerin eklenmesi'),

        heading('12. Lisans'),
        para('Bu proje özel bir projedir. Ticari veya açık kaynak lisansı altında dağıtılmamaktadır.'),

        new Paragraph({
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: '— Lise İdari Backend Proje Ekibi',
              italics: true,
              color: '666666',
            }),
          ],
        }),
      ],
    },
  ],
});

const outputPath = path.join(__dirname, '..', 'docs', 'Lise_Idari_Backend_Bilgilendirme.docx');

Packer.toBuffer(doc).then((buffer) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log('Döküman oluşturuldu:', outputPath);
});
