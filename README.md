# Lise İdari

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

### Licenses (Lisans Yönetimi)

Tenant'lara lisans tanımlama/iptal etme sadece platform admin yetkisindedir. Bir tenant'a
yeni lisans tanımlandığında, o tenant'ın varsa mevcut aktif lisansı otomatik olarak iptal edilir
(bir tenant'ın aynı anda tek aktif lisansı olur, geçmiş kayıtları korunur).

- `GET /api/licenses` - Tüm lisansları listele (Platform admin), `?tenant_id=` ve `?status=` ile filtrelenebilir
- `GET /api/licenses/:id` - Lisans detayı (Platform admin)
- `POST /api/licenses` - Tenant'a lisans tanımla (Platform admin) — gövde: `{ "tenant_id", "plan", "starts_at"?, "ends_at"?, "notes"? }`
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

| Plan | Modüller | Kullanıcı kotası |
|---|---|---|
| Free | Öğretmenler, Öğrenciler, Sınıflar | Yok |
| Standart | Okullar, Öğretmenler, Öğrenciler, Sınıflar, Yetkilendirme | En fazla 2 kullanıcı |
| Premium | Okullar, Öğretmenler, Kullanıcılar, Öğrenciler, Sınıflar | Sınırsız |
| Kurumsal | Okullar, Öğretmenler, Kullanıcılar, Öğrenciler, Sınıflar | Sınırsız |

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
    "schools": [{ "id": 1, "name": "Demo Anadolu Lisesi", "code": "DEMO-001", "role": "Müdür" }],
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
- `npm run dev:all` - Backend ve frontend birlikte
- `npm run migrate` - Migration'ları çalıştır
- `npm run migrate:undo` - Tüm migration'ları geri al
- `npm run seed` - Seed dosyalarını çalıştır
- `npm run seed:undo` - Seed dosyalarını geri al
- `npm run smoke:auth` - Auth uçlarını uçtan uca test et
- `npm run smoke:cors` - CORS ayarlarını test et
- `npm run build:frontend` - Frontend üretim derlemesi

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
