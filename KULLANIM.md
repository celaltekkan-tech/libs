# Kullanım Kılavuzu

Bu belge, Okul İdare Sistemi’nin nasıl çalıştırılacağını ve bugün hangi işlemlerin nasıl yapılacağını anlatır.

## Servisleri başlatma

İki servis birlikte çalışmalıdır:

| Servis | Adres | Komut |
|---|---|---|
| Backend (API) | http://localhost:4000 | Kök dizinde `npm run dev` |
| Frontend (panel) | http://localhost:5173 | Kök dizinde `npm run dev:frontend` |

Tek komutla ikisini birden:

```bash
npm run dev:all
```

İlk kurulum (bir kez):

```bash
npm install
cd frontend
npm install
cd ..
copy .env.example .env
npm run migrate
npm run seed
```

Kontrol:

- API sağlık: tarayıcıda http://localhost:4000/health → `{ "ok": true, ... }`
- Panel: http://localhost:5173

> **Not:** Bu makinede 3000 portu başka bir uygulamaya aittir. Bu yüzden backend **4000** portunu kullanır. Girişte 404 görürseniz panel istekleri yanlış servise gidiyor demektir; backend’in 4000’de ve panelin 5173’te çalıştığını kontrol edin.

---

## Giriş

1. http://localhost:5173 adresini açın (giriş yoksa `/login` ekranı gelir).
2. Demo yönetici ile oturum açın:

| Alan | Değer |
|---|---|
| E-posta | `admin@okul.local` |
| Şifre | `Admin1234` |

Bu hesap `npm run seed` ile oluşur; rolü **Müdür / admin**’dir.

Herkese açık kayıt kapalıdır. Yeni kullanıcıyı okul yöneticisi oluşturur (aşağıda).

---

## Hesap açma (kullanıcı oluşturma)

Panelde henüz “Kullanıcı ekle” formu yoktur. Yönetici, giriş yaptıktan sonra API üzerinden hesap açar.

```http
POST http://localhost:4000/api/users
Authorization: Bearer <girişten alınan token>
Content-Type: application/json

{
  "tenant_id": 1,
  "school_id": 1,
  "full_name": "Ayşe Demir",
  "email": "ayse@okul.local",
  "password": "Sifre1234",
  "role": "teacher"
}
```

`role` değerleri: `admin`, `supervisor`, `teacher`, `user`.

Şifre en az 8 karakter olmalıdır. Aynı e-posta ikinci kez kullanılamaz.

Kullanıcı listesi: `GET /api/users` (izin: `users.read`)  
Güncelleme: `PUT /api/users/:id`  
Pasifleştirme: `is_active: false` ile güncelleme (pasif hesap giriş yapamaz)

Gerekli izinler: oluşturma `users.create`, güncelleme `users.update`, silme `users.delete`.

---

## Okul ekleme

Seed ile gelen örnek okul: **Demo Anadolu Lisesi** (`DEMO-001`), kiracı (tenant) id = 1.

Yeni okul:

```http
POST http://localhost:4000/api/schools
Authorization: Bearer <token>
Content-Type: application/json

{
  "tenant_id": 1,
  "name": "Atatürk Anadolu Lisesi",
  "code": "AAL-001"
}
```

- `code` benzersiz olmalıdır.
- Liste: `GET /api/schools`
- Güncelleme: `PUT /api/schools/:id`
- Silme: `DELETE /api/schools/:id`

Gerekli izinler: `schools.create` / `schools.read` / `schools.update` / `schools.delete`. Demo müdür hesabında bu izinler vardır.

---

## Öğretmen işlemleri

```http
POST http://localhost:4000/api/teachers
Authorization: Bearer <token>
Content-Type: application/json

{
  "tenant_id": 1,
  "school_id": 1,
  "first_name": "Mehmet",
  "last_name": "Yılmaz",
  "title_branch": "Matematik",
  "personnel_no": "12345"
}
```

Liste: `GET /api/teachers`  
Detay: `GET /api/teachers/:id`  
Güncelleme: `PUT /api/teachers/:id`  
Silme: `DELETE /api/teachers/:id`

Gerekli izinler: `teachers.create` vb.

---

## Öğrenci işlemleri

Öğrenci modülü belgede tanımlıdır (e-Okul’dan veri alma, özel Excel çıktısı, nakil takibi). **Yazılımda henüz öğrenci API’si ve ekranı yoktur.**

Planlanan kullanım (geliştirme sonrası):

1. Yönetici öğrenci işleri menüsünü açar.
2. e-Okul’dan alınan dosya içe aktarılır.
3. Sınıf / şube / kayıt durumuna göre süzülür.
4. İstenen sütun düzeninde Excel veya PDF alınır.

Şimdilik öğrenci kaydı sisteme eklenemez. İhtiyaç duyulursa bir sonraki geliştirme adımı bu modüldür.

---

## Token nasıl alınır?

Giriş yanıtındaki `data.token` değerini kopyalayın. Panel bunu otomatik saklar. API’yi elle denemek için:

```http
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "admin@okul.local",
  "password": "Admin1234"
}
```

Sonraki isteklerde:

```http
Authorization: Bearer <token>
```

Oturum bilgisi: `GET /api/auth/me`  
Şifre değiştirme: `POST /api/auth/change-password`  
Çıkış: paneldeki **Çıkış** veya `POST /api/auth/logout`

---

## Sık karşılaşılan sorunlar

| Belirti | Anlamı | Ne yapmalı |
|---|---|---|
| `Request failed with status code 404` veya API bulunamadı | İstek yanlış porta gidiyor (çoğunlukla 3000’deki başka uygulama) | Backend’i `npm run dev` ile 4000’de çalıştırın; paneli yeniden başlatın |
| E-posta veya şifre hatalı | Demo seed çalışmamış veya şifre yanlış | `npm run seed` çalıştırın |
| Oturum süresi doldu | JWT süresi (varsayılan 8 saat) bitti | Tekrar giriş yapın |
| Bu işlem için yetkiniz yok | Rolün izni yok | Müdür / admin hesabı kullanın |
| Kayıt işlemi kapalıdır | Herkese açık register kapalı | Kullanıcıyı `POST /api/users` ile yönetici oluştursun |

Daha fazla API ayrıntısı için kök dizindeki `README.md` dosyasına bakın.
