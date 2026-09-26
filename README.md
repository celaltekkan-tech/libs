# Okul İdari

Okulların idari işlerini yönetmek için geliştirilmiş sistem. Backend (Node.js/Express REST API) ve frontend (React yönetici paneli) aynı depoda birlikte geliştirilir.

- Backend: kök dizin (`src/`), port **4000** (`http://localhost:4000`)
- Frontend: `frontend/`, port **5173** (`http://localhost:5173`)

Günlük kullanım (giriş, hesap, okul, öğretmen, öğrenci): **[KULLANIM.md](KULLANIM.md)**

## Servisleri çalıştırma

İki terminal (veya tek komut):

```bash
# 1) Backend API — http://localhost:4000
npm run dev

# 2) Yönetici paneli — http://localhost:5173
npm run dev:frontend
```

İkisini birden:

```bash
npm run dev:all
```

Sağlık kontrolü: http://localhost:4000/health  
Panel: http://localhost:5173

Otomatik ders programı çözücüsü (isteğe bağlı, yalnızca "Otomatik Ders Programı" sayfası için):

```bash
cd solver
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # Linux/mac: .venv/bin/pip
.venv/Scripts/python -m uvicorn app:app --port 8000
# backend .env: SOLVER_URL=http://127.0.0.1:8000
```

Docker'da `solver` servisi otomatik kalkar (iç ağ, `http://solver:8000`). Programı Google
OR-Tools (CP-SAT) üretir; `GEMINI_API_KEY` tanımlıysa kullanıcı istekleri serbest metinden
kısıta çevrilir (Gemini programı üretmez, yalnızca kısıt önerir, kullanıcı onaylar).
Solver'ı elle denemek için: `cd solver && python tests/run_sample.py 20 60`.

| Sorun | Çözüm |
|---|---|
| Girişte 404 | 3000 portu başka bir uygulamaya ait olabilir. Bu proje **4000** kullanır. `npm run dev` çıktısında `Server listening 4000` görünmeli; ardından paneli yeniden başlatın. |
| Veritabanı hatası | `.env` içindeki `DB_*` değerlerini kontrol edin; `npm run migrate` ve `npm run seed` çalıştırın. |

## Özellikler

- ✅ Çoklu tenant (kiracı) desteği
- ✅ Kullanıcı yönetimi ve kimlik doğrulama (JWT)
- ✅ Okul yönetimi
- ✅ Öğretmen yönetimi
- ✅ Öğrenci yönetimi (CRUD, e-Okul Excel içe aktarma, Excel/PDF dışa aktarma)
- ✅ Rol ve izin sistemi (RBAC) — tüm kaynak uçlarında zorunlu
- ✅ Hiyerarşik yapı: User -> Okul -> Müdür Yardımcısı, Memur
- ✅ Frontend entegrasyonu için CORS, helmet ve istek sınırlama (rate limit)

## Teknolojiler

- Node.js
- Express.js
- Sequelize ORM
- PostgreSQL
- JWT (JSON Web Token)
- bcrypt (şifre hash'leme)
- Joi (validasyon)

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# .env dosyası oluştur
cp .env.example .env

# Veritabanı migration'larını çalıştır
npm run migrate

# Seed dosyalarını çalıştır (roller ve izinler)
npm run seed

# Geliştirme modunda backend
npm run dev

# Ayrı bir terminalde frontend
npm run dev:frontend
```

## .env Dosyası

Tüm değişkenler ve açıklamaları için `.env.example` dosyasına bakın.

```env
DB_USER=postgres
DB_PASS=your_password
DB_NAME=lise_idari_dev
DB_HOST=127.0.0.1
DB_PORT=5432

NODE_ENV=development
PORT=4000

JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=8h

# Herkese açık kayıt ucu (varsayılan kapalı)
ALLOW_PUBLIC_REGISTER=false

# Frontend adresleri, virgülle ayrılır
CORS_ORIGIN=http://localhost:5173

# npm run seed ile oluşturulan demo yönetici
DEMO_ADMIN_EMAIL=admin@okul.local
DEMO_ADMIN_PASSWORD=Admin1234

# npm run seed ile oluşturulan platform yöneticisi (/api/tenants erişimi)
PLATFORM_ADMIN_EMAIL=superadmin@lise-idari.local
PLATFORM_ADMIN_PASSWORD=SuperAdmin1234
```

`JWT_SECRET` production ortamında tanımlı değilse sunucu başlamaz.

## Demo Kullanıcı

`npm run seed` komutu bir demo kiracı, okul ve **Müdür** rolüne sahip yönetici hesabı oluşturur:

| E-posta | Şifre | Rol |
|---|---|---|
| `admin@okul.local` | `Admin1234` | admin (Müdür) |

## API Endpoints

### Authentication

- `POST /api/auth/register` - Kullanıcı kaydı (varsayılan olarak kapalı)
- `POST /api/auth/login` - Kullanıcı girişi
- `GET /api/auth/me` - Oturumdaki kullanıcı, rolleri ve izinleri (Auth gerekli)
- `POST /api/auth/change-password` - Şifre değiştirme (Auth gerekli)
- `POST /api/auth/logout` - Oturum kapatma (Auth gerekli)

### Users

Her uç ilgili izni gerektirir: `users.read`, `users.create`, `users.update`, `users.delete`.
Ayrıca tenant'ın planında `users` modülü açık olmalıdır (bkz. Lisans Modülleri).

- `GET /api/users` - Kullanıcı listesi
- `GET /api/users/:id` - Kullanıcı detayı
- `POST /api/users` - Yeni kullanıcı oluştur
- `PUT /api/users/:id` - Kullanıcı güncelle
- `DELETE /api/users/:id` - Kullanıcı sil

### Tenants (Platform Yönetimi)

Tenant'lar üstü çalışan hesap yönetimi uçları. Sadece `is_platform_admin = true` olan
kullanıcılar erişebilir (tenant-scoped `permission`/rol sisteminden bağımsız).

- `GET /api/tenants` - Tüm hesapları listele (okul/kullanıcı sayılarıyla)
- `GET /api/tenants/:id` - Hesap detayı
- `GET /api/tenants/:id/schools` - Hesaba bağlı okullar
- `GET /api/tenants/:id/users` - Hesaba bağlı kullanıcılar
- `POST /api/tenants` - Yeni hesap oluştur (tenant + ilk okul + ilk yönetici kullanıcı, tek istekte)
- `PUT /api/tenants/:id` - Hesap güncelle (`name`, `plan`, `is_active` — askıya alma/aktifleştirme)
- `DELETE /api/tenants/:id` - Hesabı sil (bağlı okul/kullanıcı yoksa)

### Schools

Gerekli izinler: `schools.read`, `schools.create`, `schools.update`, `schools.delete`.
Ayrıca tenant'ın planında `schools` modülü açık olmalıdır (bkz. Lisans Modülleri).

- `GET /api/schools` - Okul listesi
- `GET /api/schools/:id` - Okul detayı
- `POST /api/schools` - Yeni okul oluştur
- `PUT /api/schools/:id` - Okul güncelle
- `DELETE /api/schools/:id` - Okul sil

### Coğrafi referans ve MEB okul kataloğu

Giriş yapmış kullanıcılar okuyabilir; özel izin gerekmez. `Schools` tablosundaki kurum okullarından ayrıdır.
Katalog tarama sayfası yalnızca platform yöneticisi menüsündedir (`/platform/directory-schools`); kiracılar okul eklerken aynı API üzerinden seçer.

- `GET /api/geo/provinces` - 81 il
- `GET /api/geo/districts?province_id=` - İlçeler
- `GET /api/geo/provinces/:provinceId/districts` - İlçeler (alternatif yol)
- `GET /api/geo/directory-schools` - Ortaokul/lise kataloğu (`province_id`, `district_id`, `school_type=ortaokul|lise`, `q`, `limit`, `offset`). Yanıtta varsa 6 haneli MEB `code` alanı da döner.

Kaynak: iller/ilçeler TurkiyeAPI 2025 veri seti; okullar MEB kurum listesinden derlenmiş açık veri (kurum kodları YOL alanından). Seed: `npm run seed`.

### Teachers

Gerekli izinler: `teachers.read`, `teachers.create`, `teachers.update`, `teachers.delete`.
Ayrıca tenant'ın planında `teachers` modülü açık olmalıdır (bkz. Lisans Modülleri).

- `GET /api/teachers` - Öğretmen listesi
- `GET /api/teachers/:id` - Öğretmen detayı
- `POST /api/teachers` - Yeni öğretmen oluştur
- `PUT /api/teachers/:id` - Öğretmen güncelle
- `DELETE /api/teachers/:id` - Öğretmen sil

### Students

Gerekli izinler: `students.read`, `students.create`, `students.update`, `students.delete`.
Ayrıca tenant'ın planında `students` modülü açık olmalıdır (bkz. Lisans Modülleri; tüm planlarda açıktır).

- `GET /api/students` - Öğrenci listesi (`school_id`, `class_level`, `section`, `gender`, `registration_status` query filtreleri)
- `GET /api/students/:id` - Öğrenci detayı
- `POST /api/students` - Yeni öğrenci oluştur
- `PUT /api/students/:id` - Öğrenci güncelle
- `DELETE /api/students/:id` - Öğrenci sil
- `POST /api/students/import` - e-Okul Excel (`.xlsx`) içe aktarma (`multipart` alan adı: `file`, isteğe bağlı `school_id`)
- `POST /api/students/export` - Dışa aktarma — gövde: `{ "format": "xlsx"|"pdf", "columns": [...], "filters"? }`

Frontend: `/students` sayfasından tenant kullanıcıları öğrencileri yönetebilir.

### Feedback (Geri Bildirim)

Giriş yapmış her kullanıcı kendi hesabı adına geri bildirim gönderebilir. Listeleme,
durum güncelleme ve silme sadece `is_platform_admin = true` olan kullanıcılara açıktır
(Tenants uçlarıyla aynı `platformAdmin` middleware'i kullanılır).

- `POST /api/feedback` - Geri bildirim gönder (Auth gerekli) — gövde: `{ "message": "..." }`
- `GET /api/feedback/mine` - Kendi tenant'ının gönderdiği geri bildirimleri ve varsa admin cevabını listele (Auth gerekli, tenant ile sınırlı)
- `GET /api/feedback` - Tüm hesaplara ait geri bildirimleri listele (Platform admin), `?status=` ve `?tenant_id=` ile filtrelenebilir
- `GET /api/feedback/:id` - Geri bildirim detayı (Platform admin)
- `PUT /api/feedback/:id` - Durum ve/veya cevap güncelle (Platform admin) — gövde: `{ "status"?: "new" | "read" | "resolved", "reply"?: "..." }`
- `DELETE /api/feedback/:id` - Geri bildirimi sil (Platform admin)

Frontend: `/feedback` sayfasından her kullanıcı gönderebilir ve kendi tenant'ının
gönderdiklerini + admin cevabını görebilir; `/platform/feedback` sayfasından
platform admin tüm geri bildirimleri görüntüleyip yanıtlayabilir.

### Communications (Duyurular / SMS Motoru)

Gerekli izinler: `communications.read`, `communications.create`, `communications.update`, `communications.delete`.
Ayrıca tenant'ın planında `communications` modülü açık olmalıdır.

- `GET /api/announcements` - Duyuru listesi (tenant ile sınırlı, en yeni 500)
- `GET /api/announcements/preview-recipients?target_type=&target_ids=` - Gönderim öncesi alıcı sayısını hesapla
- `POST /api/announcements` - Yeni duyuru oluştur (taslak) — gövde: `{ "title", "body", "channel": "sms"|"email"|"both", "target_type": "all"|"classroom"|"class_level"|"student", "target_ids"?: [...] }`
- `POST /api/announcements/:id/mark-sent` - Duyuruyu gönder. `channel` `sms`/`both` ise hedeflenen her öğrencinin veli telefonuna gerçek bir SMS denemesi yapılır (bkz. SMS Motoru); `channel` sadece `email` ise duyuru yalnızca "gönderildi" işaretlenir (e-posta gönderimi henüz uygulanmadı). Yanıt: `{ "data": <announcement>, "summary": { "total", "basarili", "basarisiz", "iptal" } }`
- `DELETE /api/announcements/:id` - Duyuruyu sil

Her gönderim denemesi `AnnouncementRecipient` tablosuna tek satır olarak işlenir: `phone_number`,
`status` (`beklemede` | `basarili` | `basarisiz` | `iptal`), `provider`, `provider_message_id`,
`error_message`, `sent_at`. Telefon numarası olmayan öğrenciler otomatik `iptal` olarak işaretlenir.

#### SMS Motoru (`src/services/smsEngine.js`)

Toplu SMS sağlayıcılarıyla veya bir SMS gönderme programıyla konuşan, sağlayıcıdan bağımsız
bir modül. Tek fonksiyonu dışa açar:

```js
const { sendSms, SMS_STATUS } = require('./src/services/smsEngine');

const result = await sendSms({ phoneNumber: '5551234567', message: 'Merhaba' });
// result: { status: SMS_STATUS.SUCCESS | FAILED | CANCELLED, providerName, providerMessageId, error }
```

- Telefon veya mesaj boşsa hiçbir sağlayıcıya gitmeden `SMS_STATUS.CANCELLED` (`iptal`) döner.
- Aksi halde `SMS_PROVIDER` env değişkeninde seçili sağlayıcı çağrılır; sonuç `basarili`/`basarisiz`
  olarak normalize edilir. Sağlayıcı hiçbir zaman exception fırlatıp süreci düşürmez — network/timeout/
  parse hataları da `basarisiz` sonucuna çevrilir (yapılandırma eksikliği hariç, bkz. altta).

İki yerleşik sağlayıcı (`SMS_PROVIDER` ile seçilir), tüm ayarlar `.env` üzerinden:

**`external_cli`** — bir SMS gönderme programını parametreyle çalıştırır (varsayılan sağlayıcı):

| Değişken | Açıklama |
|---|---|
| `SMS_EXTERNAL_PROGRAM_PATH` | Çalıştırılabilir programın tam yolu (zorunlu) |
| `SMS_EXTERNAL_PROGRAM_ARGS` | JSON dizi şablonu, örn. `["--to","{phone}","--text","{message}"]`. Boşsa program `[telefon, mesaj]` ile çağrılır |
| `SMS_EXTERNAL_PROGRAM_TIMEOUT_MS` | Varsayılan `15000` |

Program stdout'a **tek satır JSON** yazmalıdır:

```json
{"success": true, "messageId": "abc123"}
{"success": false, "error": "Bakiye yetersiz"}
```

Zaman aşımı, sıfırdan farklı çıkış kodu veya geçersiz/JSON-olmayan çıktı otomatik olarak
`basarisiz` sayılır; hata mesajı `error_message` alanına yazılır.

**`http_api`** — belirli bir toplu SMS firmasına bağlı olmayan, config-driven genel bir HTTP
adaptörü (firma netleşince kullanılır, kod değişikliği gerekmeden `.env` ile uyarlanır):

| Değişken | Açıklama |
|---|---|
| `SMS_HTTP_URL` | İstek atılacak uç (zorunlu) |
| `SMS_HTTP_METHOD` | Varsayılan `POST` |
| `SMS_HTTP_API_KEY` / `SMS_HTTP_API_KEY_HEADER` | API anahtarı ve hangi header'a konacağı (varsayılan `Authorization`) |
| `SMS_HTTP_BODY_TEMPLATE` | JSON gövde şablonu, `{phone}`/`{message}` yer tutucularıyla. Boşsa `{ "to": phone, "message": message }` gönderilir |
| `SMS_HTTP_SUCCESS_FIELD` | Yanıt gövdesinde başarıyı belirten alan. Boşsa yalnızca HTTP 2xx başarı sayılır |
| `SMS_HTTP_MESSAGE_ID_FIELD` / `SMS_HTTP_ERROR_FIELD` | Yanıttan mesaj id'si / hata metni okunacak alan adları |
| `SMS_HTTP_TIMEOUT_MS` | Varsayılan `15000` |

Tüm değişkenlerin varsayılanları ve açıklamaları `.env.example` içinde de yer alır. Yapılandırma
eksik/geçersizse (`SMS_EXTERNAL_PROGRAM_PATH` tanımlı değil, `SMS_HTTP_URL` tanımlı değil, geçersiz
JSON şablonu vb.) `smsEngine.SmsConfigError` fırlatılır; `announcementsController.markSent` bunu
yakalayıp `500` ile "SMS motoru yapılandırma hatası" mesajı döner — bu, tek bir alıcının
gönderim başarısızlığından ayrıdır, motor hiç çalıştırılamadığı anlamına gelir.

### İş Takibi (Work Tasks)

Tenant bazlı periyodik görevler: tek sefer / günlük / haftalık / aylık / yıllık tekrar,
zorunlu iş bayrağı, atama yalnızca aynı tenant’ın sistem kullanıcılarına (`Users`).
Frontend: `/work-tasks` (Sistem → İş Takibi). İzinler: `work_tasks.read|create|update|delete`.

- `GET /api/work-tasks` — `?mine=true`, `?overdue=true`, `?mandatory=true`, `?status=`
- `GET /api/work-tasks/:id`
- `POST /api/work-tasks` — gövde: başlık, `assignee_user_id`, `frequency`, `next_due_at`, `notify_channels` (`in_app`, `sms`, `email`), `is_mandatory`, `remind_before_minutes`
- `PUT /api/work-tasks/:id`
- `POST /api/work-tasks/:id/complete` — atanan veya `work_tasks.update` yetkisi
- `POST /api/work-tasks/:id/pause` / `resume`, `DELETE /api/work-tasks/:id`

**Hatırlatma zamanlayıcısı:** `src/server.js` içinde `node-cron` ile
`processWorkTaskReminders()` çalışır. Ortam değişkenleri:

| Değişken | Açıklama |
|---|---|
| `WORK_TASK_CRON` | Cron ifadesi (varsayılan `*/15 * * * *`) |
| `WORK_TASK_REMINDERS_ENABLED` | `false` ise cron kaydı yapılmaz |

**Öğrenci yaşı:** `src/server.js` içinde `refreshStudentAges()` her gün `Europe/Istanbul` saatine göre çalışır; doğum tarihi olan kayıtlarda `yasi` alanı güncellenir.

| Değişken | Açıklama |
|---|---|
| `STUDENT_AGE_CRON` | Cron ifadesi (varsayılan `5 0 * * *`, 00:05) |
| `STUDENT_AGE_CRON_ENABLED` | `false` ise cron kaydı yapılmaz |

Vade yaklaşınca ve zorunlu görev gecikince seçilen kanallarla bildirim gider. SMS için atanan
kullanıcının `Users.phone` alanı dolu olmalı; yoksa SMS log’da başarısız sayılır, diğer kanallar
denenmeye devam eder.

#### E-posta motoru (`src/services/emailEngine.js`)

İş takibi e-posta uyarıları için nodemailer + SMTP. Duyuru modülündeki e-posta stub’ından bağımsızdır.

| Değişken | Açıklama |
|---|---|
| `SMTP_HOST` | SMTP sunucusu (zorunlu) |
| `SMTP_FROM` | Gönderen adresi (zorunlu) |
| `SMTP_PORT` | Varsayılan `587` |
| `SMTP_SECURE` | `true` veya port `465` ise TLS |
| `SMTP_USER` / `SMTP_PASS` | Kimlik doğrulama (opsiyonel) |

`notify_channels` içinde `email` seçiliyken SMTP yapılandırması eksikse gönderim hata log’una yazılır.

### Licenses (Lisans Yönetimi)

Tenant'lara lisans tanımlama/iptal etme sadece platform admin yetkisindedir. Bir tenant'a
yeni **ana** lisans tanımlandığında, o tenant'ın varsa mevcut aktif ana lisansı otomatik olarak
iptal edilir (geçmiş kayıtları korunur). **SMS** eklenti lisansı ana lisansı iptal etmez; yanına
eklenir. Yeni SMS lisansı yalnızca önceki SMS eklentisini değiştirir. SMS vermek için hesabın
aktif bir ana lisansı olmalıdır.

- `GET /api/licenses` - Tüm lisansları listele (Platform admin), `?tenant_id=` ve `?status=` ile filtrelenebilir
- `GET /api/licenses/:id` - Lisans detayı (Platform admin)
- `POST /api/licenses` - Tenant'a lisans tanımla (Platform admin) — gövde: `{ "tenant_id", "plan", "starts_at"?, "ends_at"?, "notes"? }` (SMS paketlerinde kota plandan gelir: SMS 3000 / SMS 10000)
- `PUT /api/licenses/:id/cancel` - Lisansı iptal et (Platform admin)

Frontend: `/platform/licenses` sayfasından platform admin lisansları görüntüleyip
tanımlayabilir/iptal edebilir; ilgili hesabın aktif lisansı `/platform/tenants/:id`
sayfasında da özet olarak gösterilir.

#### Lisans zorunluluğu (Faz 1)

`GET/POST/PUT/DELETE /api/teachers`, `/api/students`, `/api/schools`, `/api/users` uçları `licenseGuard`
middleware'i ile korunur: tenant'ın aktif (süresi dolmamış) bir lisansı yoksa istek
`402 LICENSE_EXPIRED` ile reddedilir. Platform admin bu kontrolden muaftır.

`POST /api/auth/login` ve `GET /api/auth/me` yanıtlarına `license_status`
(`'active' | 'expired' | 'exempt'`) ve `license` (aktif lisans, yoksa `null`) alanları
eklendi. Frontend, `license_status: 'expired'` olan tenant kullanıcılarını `/` ve
`/feedback` dahil tüm uygulamadan engelleyip "Lisans süresi doldu" ekranını gösterir
(sadece çıkış yapabilirler). Platform admin (`exempt`) bu kısıtlamadan etkilenmez.

**Faz 2 (henüz yapılmadı)**: Lisansı bitmiş kullanıcıların self-servis "yeni lisans
alma/yenileme" arayüzüne yönlendirilmesi ve sadece o arayüze erişebilmesi.

#### Lisans Modülleri (plana göre menü/API erişimi)

Her planın hangi tenant modüllerini (menü + API) açtığı `src/config/licensePlans.js`
içinde tanımlıdır (frontend karşılığı: `frontend/src/constants/licensePlans.ts`):

| Plan | Tür | Modüller | Kota |
|---|---|---|---|
| Basic | Ana | Öğretmenler, Öğrenciler, Sınıflar | 1 okul; kullanıcı yok |
| Standart | Ana | Okullar, Öğretmenler, Öğrenciler, Sınıflar, Yetkilendirme, Mobil ve diğer idari modüller | 1 okul; öğretmen/rehber hariç 2 kullanıcı |
| Premium | Ana | Standart ile aynı | En fazla 3 okul; sınırsız kullanıcı |
| SMS 3000 | Eklenti | Modül açmaz | 3.000 başarılı SMS (lisans süresince) |
| SMS 10000 | Eklenti | Modül açmaz | 10.000 başarılı SMS (lisans süresince) |

SMS eklentisi olmayan hesaplar öğretmen kayıt doğrulaması dışında SMS kullanamaz (veli duyurusu, görev hatırlatması, SMS ile giriş). Kota dolunca gönderim `402 SMS_QUOTA_EXCEEDED`, lisans yoksa `403 SMS_LICENSE_REQUIRED` döner. Lisans bitiminde veya yenilemede kullanılmayan SMS kredileri sıfırlanır; yeni lisans paket kotasıyla (0 kullanılmış) başlar. `login`/`me` yanıtındaki `sms_license` alanı kalan kotayı taşır.

`moduleGuard` middleware'i (`src/middlewares/moduleGuard.js`) `teachers`/`students`/`schools`/`users`
uçlarını korur: aktif lisans yoksa `402 LICENSE_EXPIRED`, lisans var ama modül plana
dahil değilse `403 MODULE_NOT_LICENSED` döner. Platform admin muaftır.

`login`/`me` yanıtındaki `modules` alanı, frontend'in sol menüde hangi öğeleri
göstereceğini belirler (`AppLayout.tsx`); `/schools`, `/teachers`, `/students`, `/users` rotaları
`ModuleRoute` ile ayrıca korunur (URL ile doğrudan erişim denemesi ana sayfaya yönlendirilir).
Sayfa içi Yeni/Düzenle/Sil butonları mevcut `permissions` dizisine göre ayrıca gizlenir.

## Kullanım Örnekleri

### Kullanıcı Girişi

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@okul.local",
  "password": "Admin1234"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "full_name": "Demo Okul Müdürü",
      "email": "admin@okul.local",
      "role": "admin",
      "tenant_id": 1,
      "school_id": 1,
      "is_active": true,
      "last_login_at": "2026-09-01T13:40:00.000Z"
    },
    "roles": ["Müdür"],
    "permissions": ["schools.create", "teachers.read", "users.read", "..."],
    "schools": [{ "id": 1, "name": "Demo Anadolu Lisesi", "code": "100001", "role": "Müdür" }],
    "is_global_admin": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2026-09-01T21:40:00.000Z"
  }
}
```

`GET /api/auth/me` aynı gövdeyi `token` ve `expires_at` olmadan döner. Frontend, sayfa
yenilendiğinde oturumu bu uç ile doğrular.

### Authenticated Request

```bash
GET /api/teachers
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Şifre Değiştirme

```bash
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "Admin1234",
  "new_password": "YeniSifre123"
}
```

## Hata Yanıtları

Tüm hatalar aynı biçimde döner ve frontend'in davranış belirleyebilmesi için bir `code` içerir.

```json
{ "success": false, "code": "TOKEN_EXPIRED", "message": "Oturum süresi doldu, lütfen tekrar giriş yapın" }
```

| Kod | HTTP | Anlamı |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Gönderilen alanlar geçersiz (`errors` dizisi alan bazlı mesaj içerir) |
| `INVALID_CREDENTIALS` | 401 | E-posta veya şifre hatalı |
| `TOKEN_MISSING` | 401 | Authorization başlığı yok veya Bearer değil |
| `TOKEN_EXPIRED` | 401 | Token süresi doldu → giriş ekranına yönlendir |
| `TOKEN_INVALID` | 401 | Token bozuk veya imzası geçersiz |
| `ACCOUNT_DISABLED` | 403 | Kullanıcı pasif durumda |
| `TENANT_DISABLED` | 403 | Hesap (tenant) askıya alınmış |
| `PLATFORM_ADMIN_REQUIRED` | 403 | `/api/tenants` uçları için platform yöneticisi yetkisi gerekir |
| `PERMISSION_DENIED` | 403 | Gerekli izin yok (`required` alanı hangi izin gerektiğini söyler) |
| `ROLE_DENIED` | 403 | Gerekli rol yok |
| `REGISTRATION_DISABLED` | 403 | Herkese açık kayıt kapalı |
| `CORS_BLOCKED` | 403 | İstek izin verilmeyen bir origin'den geldi |
| `NOT_FOUND` | 404 | Uç veya kayıt bulunamadı |
| `EMAIL_IN_USE` / `DUPLICATE_RECORD` | 409 | Kayıt zaten mevcut |
| `RATE_LIMITED` | 429 | Çok fazla istek (giriş uçlarında 15 dakikada 10 başarısız deneme) |
| `LICENSE_EXPIRED` | 402 | Tenant'ın aktif lisansı yok/süresi dolmuş (teachers/students/schools/users uçları) |
| `INTERNAL_ERROR` | 500 | Beklenmeyen sunucu hatası |

## Frontend

Panel `frontend/` klasöründedir: React + Vite + TypeScript + Ant Design.

```bash
cd frontend
npm install
npm run dev
```

Geliştirmede Vite, `/api` isteklerini backend'e (`http://localhost:4000`) proxy eder. Doğrudan backend adresine bağlanmak için `frontend/.env` içinde `VITE_API_URL=http://localhost:4000` tanımlanabilir; bu durumda `CORS_ORIGIN` frontend adresini içermelidir.

- Login: `POST /api/auth/login` → token `localStorage`'a yazılır
- Sayfa yenileme: `GET /api/auth/me` ile oturum doğrulanır
- `TOKEN_EXPIRED` / `TOKEN_INVALID` / `ACCOUNT_DISABLED` → oturum temizlenir, login ekranına dönülür
- Menü ve buton görünürlüğü `permissions` dizisine göre belirlenir; yetki kontrolü backend'de de zorunludur

Demo giriş: `admin@okul.local` / `Admin1234`

Kullanıcı işlemleri (hesap, okul, öğretmen, öğrenci): [KULLANIM.md](KULLANIM.md)

### Doğrulama Komutları

Backend ayaktayken:

```bash
npm run smoke:auth   # login, /me, yetki ve hata kodlarını uçtan uca test eder
npm run smoke:cors   # frontend origin'inin CORS ayarlarıyla uyumunu test eder
npm run build:frontend
```

## Mobil Uygulama (Expo)

Öğretmenlerin sınıfta hızlıca öğrenci arayıp disiplin bildirimi (öğretmen notu) oluşturması için `mobile/` klasöründe ayrı bir React Native (Expo) uygulaması bulunur: sunucu adresi girme, öğretmen kaydı (lisanslı okul + T.C. kimlik no/soyad/e-posta/telefon, yalnızca SMS doğrulama), giriş, şifre değiştirme, öğrenci numarasıyla arama, hazır/serbest sebep etiketleriyle not oluşturma, kendi gönderdiği bildirimleri listeleme. Aynı backend uçlarını kullanır (`POST /api/auth/teacher-register`, `POST /api/auth/login`, `POST /api/auth/change-password`, `GET /api/auth/me`, `GET /api/students/lookup/:number`, `GET /api/teacher-notes/tag-options`, `POST /api/teacher-notes`, `GET /api/teacher-notes/mine`). **Bu, web yönetim panelinden tamamen farklı, ayrı bir uygulamadır** — panelin URL'sini telefon tarayıcısında açmak bu deneyimi vermez, aşağıdaki gibi kurulmuş/başlatılmış olması gerekir.

Backend adresi APK'ya gömülü değildir: uygulama ilk açılışta "Sunucu Adresi" ekranını gösterir, girilen adres yalnızca o cihazda saklanır. Adres değiştiğinde (örn. LAN IP'den `https://api.oids.com.tr`'ye geçince) uygulamayı yeniden kurmaya gerek yoktur — giriş ekranındaki **Sunucu: ... (değiştir)** bağlantısına dokunup yeni adresi girmek yeterlidir.

### Geliştirme sırasında test etme (Expo Go)

En hızlı yol — kurulum/build gerektirmez, günlük geliştirme için kullanılır:

```bash
# 1) Backend'in telefonun erişebileceği bir adreste çalışıyor olması lazım
npm run dev              # kök dizinde — http://<bilgisayarın-LAN-IP'si>:4000

# 2) Mobil geliştirme sunucusu (Expo Go ile test için --go zorunlu)
cd mobile
npm install
npm run start:go
```

1. Telefona **Expo Go** uygulamasını kurun (App Store / Play Store).
2. Bilgisayar ve telefon **aynı Wi-Fi ağında** olmalı.
3. `npm start` çıktısındaki QR kodu Expo Go ile (Android) veya kamerayla (iOS) okutun.
4. Uygulama açılınca "Sunucu Adresi" ekranına bilgisayarın LAN IP'sini girin (örn. `http://192.168.1.10:4000`) — `ipconfig` (Windows) ile bulabilirsiniz.

Bu yöntemle telefona kalıcı bir uygulama simgesi kurulmaz; Expo Go içinde çalışır, geliştirme bittiğinde kapatılır.

> **Not:** `mobile/package.json`'da `expo-dev-client` paketi bulunduğu için düz `npm start`/`expo start` komutu artık varsayılan olarak "development build" moduna geçer ve düz Expo Go ile bağlanınca "Something went wrong" hatası verir. Expo Go ile test ederken mutlaka `npm run start:go` kullanın.

### Gerçek cihaza kurulum — APK üretme ve indirme (EAS Build)

Kalıcı olarak öğretmenlerin telefonuna kurulacak bir `.apk` üretmek için `mobile/eas.json` hazır. Bu adımlar **sizin** kendi bilgisayarınızdan, kendi Expo hesabınızla çalıştırmanız gerekir (bende bu hesaba erişim yok):

```bash
cd mobile
npx eas login              # Expo hesabınızla giriş (yoksa expo.dev'den ücretsiz oluşturulur)
npx eas build:configure    # Projeyi EAS hesabınıza bağlar (app.json'a projectId ekler)
npm run build:preview      # APK üretir (profil: preview, platform: android)
```

Build birkaç dakika sürer ve Expo'nun bulut sunucularında çalışır (bilgisayarınızda Android Studio/SDK gerekmez). Bittiğinde:

- Terminalde build'in bittiğine dair bir **indirme linki (.apk)** yazdırılır; o linki telefonda açıp dosyayı indirip kurabilirsiniz, veya
- **expo.dev** üzerinde hesabınıza giriş yapıp projenizin **Builds** sekmesinden aynı APK'yı indirebilirsiniz.

Android'de "bilinmeyen kaynaklardan yükleme" (Play Store dışı APK) izni açık olmalı; ilk kurulumda telefon bunu otomatik sorar.

Adres netleştiğinde ve sabitlendiğinde tekrar build almanıza gerek yok — sadece uygulama içindeki "Sunucu Adresi" ekranından yeni adresi girmeniz yeterli. `npm run build:production` ise mağaza (Play Store/App Store) dağıtımı için `.aab`/ipa üretir; şimdilik gerekli değil.

### Kullanım (öğretmen için)

0. **Sunucu Adresi** (yalnızca ilk açılışta): Okul yöneticisinin verdiği backend adresini girip **Kaydet ve Devam Et**'e basılır.
1. **Kayıt** (ilk kez): Giriş ekranında **Hesabım yok, öğretmen kaydı oluştur**. İl / ilçe / okul seçilir (yalnızca sistemde geçerli lisansı olan okullar listelenir). T.C. kimlik numarası, soyad, e-posta ve cep telefonu girilir. T.C. kimlik no + soyad o okuldaki öğretmen kartıyla eşleşirse ve girilen telefon, öğretmenin kayıtlı telefonuyla aynıysa **Öğretmen** yetkisiyle kullanıcı açılır ve telefona 6 haneli SMS doğrulama kodu gider (e-posta doğrulaması yoktur). Varsayılan şifre **T.C. kimlik numarası**dır.
2. **Giriş** (kayıtlı öğretmen): E-posta ve şifre ile giriş yapılır. Hesabında iki adımlı doğrulama (2FA) veya SMS girişi açıksa mobil uygulama şu an bunu desteklemez; okul yöneticisinden bu ayarın kapatılmasını isteyin.
3. **Şifre değiştirme**: "Öğrenci Ara" ekranındaki **Şifre** ile mevcut şifre (ilk girişte T.C. kimlik no) değiştirilir; yeni şifre en az 8 karakter olmalıdır.
4. **Öğrenci arama**: "Öğrenci Ara" ekranında öğrenci numarası girilip **Ara**'ya basılır. Öğrenci bulunursa fotoğrafı, adı-soyadı ve sınıfı gösterilir.
5. **Bildirim oluşturma**: Öğrenci kartındaki **Bildirim Oluştur**'a basılır. Açılan ekranda:
   - Hazır sebep etiketlerinden istenildiği kadarı seçilir (çoklu seçim),
   - gerekirse kendi sebebiniz yazılıp **Ekle**'ye basılır,
   - isteğe bağlı bir not eklenebilir,
   - en az bir etiket/sebep veya not girildikten sonra **Gönder**'e basılır.
   Bildirim kaydedilince okul yönetiminin disiplin ekranına düşer.
6. **Geçmiş bildirimler**: "Öğrenci Ara" ekranının sağ üstündeki **Geçmiş** bağlantısıyla, o öğretmenin daha önce gönderdiği tüm bildirimler (öğrenci, etiketler, not, tarih) listelenir; aşağı çekerek yenilenebilir.
7. **Çıkış**: "Öğrenci Ara" ekranının sağ üstündeki **Çıkış** ile oturum kapatılır ve cihazdaki token silinir (sunucu adresi silinmez).

Uygulamayı kapatıp yeniden açtığınızda oturum açık kalır (token cihazda saklanır); şifre değiştirildiyse veya hesap pasifleştirildiyse bir sonraki açılışta otomatik çıkış yapılır.

- `discipline` modülü kapalıysa veya kullanıcının `teacher_notes.create` izni yoksa not oluşturma/listeleme uçları 403 döner. `GET /api/teacher-notes/mine` yalnızca isteği yapan öğretmenin kendi bildirimlerini döner (`discipline.read` gerektirmez); tüm okulun bildirimlerini görmek yönetici panelindeki disiplin ekranı üzerinden yapılır.
- Fiziksel cihazdan bağlanırken `localhost` çalışmaz; backend'in çalıştığı makinenin LAN IP'sini (veya prod domain'ini) girin ve backend `CORS_ORIGIN`'de bu adrese izin verildiğinden emin olun (not: native uygulama istekleri tarayıcı CORS kısıtına tabi değildir, bu ayar yalnızca web paneli için gereklidir).
- Uygulama ikonu/splash görseli hâlâ Expo'nun varsayılanı; gerçek kurum logosu geldiğinde `mobile/assets/` altındaki dosyalar değiştirilmeli.

## Rol ve İzin Sistemi

Sistemde iki katmanlı rol yapısı vardır:

- **Global rol** (`Users.role`): `admin`, `supervisor`, `teacher`, `user`. `admin` ve
  `supervisor` tüm izinlere sahiptir.
- **Okul bazlı rol** (`users_schools` → `roles`): Müdür, Müdür Yardımcısı, Memur, Öğretmen.
  Kullanıcının izinleri bu rollere bağlı `permissions` kayıtlarından hesaplanır.

### Roller

- **Müdür**: Tüm izinlere sahip
- **Müdür Yardımcısı**: Öğretmen, öğrenci ve kullanıcı yönetimi, okul okuma
- **Memur**: Öğretmen/öğrenci oluşturma/güncelleme, kullanıcı okuma, okul okuma
- **Öğretmen**: Sadece okuma izinleri

### İzinler

- `teachers.read`, `teachers.create`, `teachers.update`, `teachers.delete`
- `students.read`, `students.create`, `students.update`, `students.delete`
- `users.read`, `users.create`, `users.update`, `users.delete`
- `schools.read`, `schools.create`, `schools.update`, `schools.delete`

### Permission Middleware Kullanımı

```javascript
const permission = require('./middlewares/permission');

// Tek izin kontrolü
router.get('/teachers', auth, permission('teachers.read'), ctrl.list);

// Çoklu izin kontrolü
router.post('/teachers', auth, permission(['teachers.create', 'teachers.update']), ctrl.create);

// Rol kontrolü
const checkRole = permission.checkRole;
router.delete('/teachers/:id', auth, checkRole(['Müdür', 'Müdür Yardımcısı']), ctrl.remove);
```

## Veritabanı Yapısı

### Hiyerarşi

```
Tenant (Kiracı)
  └── School (Okul)
       └── User (Kullanıcı)
            └── UserSchool (Kullanıcı-Okul-Rol İlişkisi)
                 ├── Role (Müdür Yardımcısı, Memur, vb.)
                 └── Permission (İzinler)
```

### Tablolar

- `Tenants` - Kiracılar
- `Schools` - Okullar
- `Users` - Kullanıcılar
- `Teachers` - Öğretmenler
- `Students` - Öğrenciler
- `roles` - Roller
- `permissions` - İzinler
- `role_permissions` - Rol-İzin ilişkileri
- `users_schools` - Kullanıcı-Okul-Rol ilişkileri

## Geliştirme Notları

- Çoklu tenant mantığı: JWT payload içinde `tenant_id` barındırılır ve tüm sorgularda `tenant_id` filtrelemesi uygulanır.
- Modeller `underscored: true` kullanır; migration'lardaki `created_at` / `updated_at` kolonlarıyla uyum bu ayara bağlıdır.
- Seeder'lar `seederStorage: 'sequelize'` ile takip edilir ve tekrar çalıştırıldığında veriyi çoğaltmaz.
- Performans için büyük verilerde pagination eklenebilir.
- Audit/logging ve soft delete (`paranoid:true`) gibi özellikler eklenebilir.
- Production ortamında DB sync yerine `sequelize-cli` migrations kullanılmalıdır.
- Token yenileme (refresh token) henüz yoktur; oturum `JWT_EXPIRES_IN` süresi dolduğunda sona erer.

## Scripts

- `npm start` - Production modunda backend
- `npm run dev` - Backend geliştirme (nodemon, port 4000)
- `npm run dev:frontend` - Yönetici paneli (Vite, port 5173)
- `npm run dev:mobile` - Öğretmen mobil uygulaması (Expo)
- `npm run dev:all` - Backend ve frontend birlikte
- `npm run migrate` - Migration'ları çalıştır
- `npm run migrate:undo` - Tüm migration'ları geri al
- `npm run seed` - Seed dosyalarını çalıştır
- `npm run seed:undo` - Seed dosyalarını geri al
- `npm run smoke:auth` - Auth uçlarını uçtan uca test et
- `npm run smoke:cors` - CORS ayarlarını test et
- `npm run build:frontend` - Frontend üretim derlemesi

## Docker ile Çalıştırma (Production)

Proje; veritabanı (`db`), backend (`backend`), yönetici paneli (`frontend`),
tanıtım/landing sayfası (`landing`) ve mobil Expo geliştirme sunucusu (`mobile`)
olmak üzere beş ayrı container olarak çalışacak şekilde yapılandırılmıştır.

**Kullanılan kurulum: ayrı subdomain'ler** (`app.oids.com.tr` → frontend, `api.oids.com.tr`
→ backend). Bu yüzden hem `frontend` hem `backend` NPM'in Docker network'üne katılır ve
`.env` içindeki `VITE_API_URL=https://api.oids.com.tr` ile frontend build'i API isteklerini
doğrudan API subdomain'ine gönderir. Bu, gerçek bir cross-origin istektir; bu yüzden
`CORS_ORIGIN` içine `https://app.oids.com.tr` mutlaka eklenmelidir (aksi halde tarayıcı
istekleri backend tarafından reddedilir).

NPM'de oluşturulacak iki Proxy Host:
- `app.oids.com.tr` → Forward Hostname/IP: `frontend`, Port: `80`
- `api.oids.com.tr` → Forward Hostname/IP: `backend`, Port: `4000`

(Frontend'in kendi nginx'i `/api` ve `/health`'i `backend`'e proxy'lemeye devam eder;
`VITE_API_URL` boş bırakılırsa bu tek-domain/same-origin kurulum da desteklenir, o
durumda `backend`'in `proxy` network'üne katılmasına gerek yoktur.)

```bash
# 1) .env dosyasını oluşturun (yoksa)
cp .env.example .env
# DB_USER / DB_PASS / DB_NAME, JWT_SECRET, VITE_API_URL, CORS_ORIGIN vb. değerleri doldurun.

# 2) NPM'in kullandığı network adını bulun
docker network ls
# .env içine NPM_NETWORK_NAME=<bulduğunuz-ad> yazın (örn. nginx-proxy-manager_default)

# 3) Build edip ayağa kaldırın (migration'lar ve seed'ler backend başlarken otomatik çalışır)
docker compose up -d --build
```

Notlar:
- Migration'lar ve seed'ler `backend` container'ı her başladığında otomatik çalışır
  (`docker/backend-entrypoint.sh`, `npx sequelize db:migrate` + `db:seed:all`). Seed'ler
  `SequelizeData` tablosunda takip edildiği için sadece yeni eklenenler çalışır, idempotent'tir.
- `db` yalnızca dahili (`internal`) network'te yer alır, dışarıya hiç port açmaz.
  `backend` ve `frontend` NPM'in network'üne katılır ama kendi başlarına host'a port
  açmazlar; dışarıdan erişim yalnızca NPM üzerinden mümkündür.
- Veriler Docker'ın kendi iç volume'lerinde değil, doğrudan host makinede tutulur:
  Postgres verisi `./data/postgres`, yüklenen dosyalar `./uploads` klasöründedir.
  `docker compose down`, `up -d --build`, container silme/yeniden oluşturma gibi
  işlemler bu klasörlere dokunmaz; veri kaybı yaşamamak için tek şart bu klasörleri
  **silmemek** ve düzenli yedeklemektir (`data/postgres` ve `uploads`).

### Landing Sayfası

`landing/` altında, build adımı gerektirmeyen statik bir tanıtım sayfası vardır
(`index.html` + `styles.css` + `script.js`, nginx ile servis edilir). Modülleri
kısa ve öz şekilde tanıtır, plan/fiyat bilgisi `frontend/src/constants/licensePlans.ts`
ile tutarlıdır. NPM'de eklenecek proxy host:

- `oids.com.tr` (ve isteğe bağlı `www.oids.com.tr`) → Forward Hostname/IP: `landing`, Port: `80`

İçeriği güncellemek için `landing/index.html` düzenlenir, `docker compose up -d --build landing`
ile yeniden build edilir — ayrı bir build aracı veya bağımlılık gerekmez.

### Mobil (Expo) Sunucusu

`mobile` container'ı, dev ortamında `npm run dev:mobile` ile elde edilen aynı
şeyi (Expo/Metro geliştirme sunucusu, port `8081`) prod'da kalıcı olarak
ayakta tutar. `expo-dev-client` paketi kurulu olduğu için `expo start` doğrudan
"development build" moduna geçer — öğretmenlerin telefonuna EAS ile üretilmiş
bir dev-client `.apk` kurulu olması, uygulamayı açarken **Sunucu Adresi**
ekranına bu domaini girmesi gerekir. Bu bir geliştirme sunucusudur, EAS'in
ürettiği bağımsız production `.apk`'nın yerini almaz — yalnızca JS bundle'ı
canlı servis eder; kalıcı/store dağıtımı için yine `eas build --profile
production` kullanılmalıdır.

NPM'de eklenecek proxy host:

- `mobile.oids.com.tr` → Forward Hostname/IP: `mobile`, Port: `8081`
  **Websockets Support mutlaka açılmalı** (Metro'nun bundle/HMR trafiği
  WebSocket üzerinden gider; kapalıysa dev-client/Expo Go bağlanamaz).

**Expo Go'da bağlantı adresi önemli:** "Enter URL" alanına `exp://mobile.oids.com.tr`
yazılırsa istemci portu kendisi `:8081` olarak varsayar ve düz `http://` ile doğrudan
o porta bağlanmaya çalışır — NPM'in 443'te TLS sonlandırdığı proxy host'u hiç
kullanmaz, bu yüzden bağlanamaz. Bunun yerine **`https://mobile.oids.com.tr`**
(açık şema + portsuz) girilmeli; bu, standart 443 üzerinden NPM'e gider ve NPM
zaten container'ın 8081 portuna yönlendirir. `exp://` yalnızca `expo start`'ın
kendi bastığı LAN QR/URL'sinde (dev makinesi ile aynı ağda) anlamlıdır.

**Manifest URL'leri:** Metro, manifest'teki bundle adresini varsayılan olarak
`https://mobile.oids.com.tr:8081/index.ts.bundle...` şeklinde üretir; manifest 443'ten
gelse bile telefon bundle'ı dışarıya kapalı 8081'den istemeye çalışıp bağlanamaz.
Bu yüzden `docker-compose.yml`'da `mobile` servisine
`EXPO_PACKAGER_PROXY_URL=https://mobile.oids.com.tr` verilir (farklı domain için
`.env`'de geçersiz kılın). Doğrulama:
`curl -H "expo-platform: android" https://mobile.oids.com.tr/ | grep -o '"url":"[^"]*bundle'`
çıktısında `:8081` olmamalıdır.

Kod değişikliği sonrası yeniden build gerekmez (Metro dosya değişikliklerini
canlı yakalar); container'ın kendisini güncellemek için
`docker compose up -d --build mobile` yeterlidir.

### Otomatik Deploy (dev → master)

Geliştirme `dev` branch'inde yapılır. `dev` → `master` merge/push edildiğinde,
sunucuda cron ile periyodik çalışan `scripts/deploy-watch.sh` yeni commit'i görüp
otomatik olarak `git pull` yapar. Build/deploy (`docker compose up -d --build`)
otomatik tetiklenmez, elle çalıştırılır.

Sunucuda tek seferlik kurulum:

```bash
# 1) Repoyu sunucuya klonlayın ve production .env dosyasını oluşturun
git clone https://github.com/celaltekkan-tech/libs.git /opt/libs
cd /opt/libs
git checkout master
cp .env.example .env   # gerçek değerleri doldurun (DB_*, JWT_SECRET, NPM_NETWORK_NAME, ...)

# 2) İlk build
docker compose up -d --build

# 3) Deploy script'ini çalıştırılabilir yapın
chmod +x scripts/deploy-watch.sh

# 4) Cron'a ekleyin (her 5 dakikada bir kontrol eder, log dosyasına yazar)
mkdir -p logs
crontab -e
# aşağıdaki satırı ekleyin:
*/5 * * * * /opt/libs/scripts/deploy-watch.sh >> /opt/libs/logs/deploy.log 2>&1
```

Notlar:
- `scripts/deploy-watch.sh` sadece `master` branch'ini izler (`DEPLOY_BRANCH` env
  değişkeniyle değiştirilebilir) ve yalnızca fast-forward mümkünse pull yapar; sunucuda
  elle değişiklik yapılmamalıdır.
- Aynı anda iki deploy'un çakışmaması için `flock` ile kilitlenir.
- Script yalnızca `git pull` yapar, `docker compose up -d --build` çalıştırmaz — build/deploy
  elle tetiklenir. Migration'lar ve seed'ler backend container'ı her (yeniden) başladığında
  (yani build sonrası) otomatik uygulanır.
- `dev` branch'inde çalışırken sunucu hiçbir şekilde etkilenmez; sadece `master`'a
  merge/push edildiğinde bir sonraki cron taramasında (en fazla 5 dk içinde) pull edilir.

### Geri bildirim senkronu (dev ↔ prod)

Geri bildirimler her ortamın kendi veritabanındadır. Senkron, kayıtları `public_id`
ile eşler; hesap ve kullanıcı numaraları farklı olsa da kurum adı ve e-posta
karşı tarafta varsa yerel hesaba bağlanır. Durum, yazışma, ek dosya ve silme
iki yöne gider. Aynı kayıt iki tarafta da değiştiyse **daha yeni `updated_at`
kazanır**. İki sunucunun saati yakın olmalıdır; karşılaştırma bu zamana bakar.

Her iki `.env` dosyasında aynı gizli anahtar, farklı ortam adı ve karşı tarafın
API adresi tanımlanır:

```bash
# Geliştirme makinesi
FEEDBACK_SYNC_ENV=dev
FEEDBACK_SYNC_PEER_URL=https://api.oids.com.tr
FEEDBACK_SYNC_SECRET=uzun-rastgele-anahtar

# Canlı sunucu
FEEDBACK_SYNC_ENV=prod
FEEDBACK_SYNC_PEER_URL=https://api-dev.example.com
FEEDBACK_SYNC_SECRET=uzun-rastgele-anahtar
```

`FEEDBACK_SYNC_PEER_URL` karşı tarafın dışarıdan erişilen API köküdür (sonda `/` yok).
Geliştirme makinesi canlıya ulaşır ama canlı, geliştirme makinesine ulaşamazsa
canlıda `FEEDBACK_SYNC_PEER_URL` boş bırakılır. Canlı yalnızca istekleri
karşılar (`FEEDBACK_SYNC_SECRET` ve `FEEDBACK_SYNC_ENV` yine gerekir); çekme ve
yazma geliştirme tarafının zamanlayıcısında olur. İki sunucu da birbirine
ulaşabiliyorsa ikisi de aynı işi yapar, ikinci çalıştırma aynı kayıtları
yeniden yazmaz.

Uygulama ayarlıysa her 5 dakikada bir dener (`FEEDBACK_SYNC_CRON`). Kapatmak
için `FEEDBACK_SYNC_ENABLED=false`. Platform yöneticisi **Geri Bildirimler**
ekranından da **Senkronize et** diyebilir. Migration `20260926000005` her iki
veritabanında da uygulanmış olmalıdır (backend açılışında otomatik).

Ek dosyalar ayrıca indirilir; bir kayıtta en fazla 5 dosya ve dosya başına 5 MB
sınırı geçerlidir. Karşı tarafta aynı e-posta yoksa kayıt yine listelenir,
yazar adı anlık kopyadan gösterilir.

### Veritabanı Yedekleme

Uygulama `pg_dump` ile sıkıştırılmış (`.sql.gz`) yedek alır. **Platform Yönetimi → Yedekleme** ekranından:

- yedek klasörü
- her gün başlama saati (Europe/Istanbul)
- saklama süresi (gün)

ayarlanır. Aynı ekrandan **Şimdi yedek al** ve **Geri yükle** çalışır. Saklama süresini aşan dosyalar bir sonraki yedeklemede silinir.

Docker'da yedekler host'taki `BACKUP_HOST_DIR` (varsayılan `./backups`) klasörüne yazılır; paneldeki yol container içinde `/app/backups` olur. Geliştirmede Windows için `PG_DUMP_PATH` / `PSQL_PATH` gerekebilir.

Notlar:
- Zamanlama uygulama içindedir; ayrı bir host crontab satırı gerekmez. Eski `scripts/db-backup.sh` cron'u varsa çift yedek alınmaması için kaldırın.
- Aynı anda iki yedekleme/geri yükleme çakışmasın diye kilitlenir.
- Geri yükleme mevcut veritabanının üzerine yazar; onay kelimesi ister.
- Elle geri yükleme örneği: `gunzip -c backups/<dosya>.sql.gz | docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME"`

## Güvenlik

- Şifreler bcrypt ile hash'lenir; `password_hash` hiçbir API yanıtında dönmez
- JWT token'lar ile kimlik doğrulama; süresi dolan token için `TOKEN_EXPIRED` kodu döner
- Tenant izolasyonu (her kullanıcı sadece kendi tenant'ındaki verilere erişebilir)
- Rol ve izin bazlı yetkilendirme tüm kaynak uçlarında zorunludur
- Herkese açık kayıt varsayılan olarak kapalıdır; açıldığında bile rol `teacher` olarak sabitlenir
- Giriş uçlarında istek sınırlama, tüm uçlarda `helmet` güvenlik başlıkları
- `CORS_ORIGIN` dışındaki adreslerden gelen tarayıcı istekleri reddedilir

## Lisans

Bu proje özel bir projedir.
