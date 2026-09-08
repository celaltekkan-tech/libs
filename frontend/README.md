# Okul İdare Sistemi — Frontend

Yönetici paneli. Geliştirmede Vite, `/api` isteklerini `http://localhost:4000` adresindeki backend’e yönlendirir.

## Çalıştırma

Kök dizinde backend ayakta olmalıdır (`npm run dev`, port **4000**).

```bash
cd frontend
npm install
npm run dev
```

veya kök dizinden: `npm run dev:frontend`

Adres: `http://localhost:5173`  
Demo: `admin@okul.local` / `Admin1234`

Kullanım adımları: kök dizindeki [KULLANIM.md](../KULLANIM.md)

## Yapı

- `src/api` — Axios istemcisi ve auth uçları
- `src/auth` — Oturum bağlamı, korumalı/misafir rotalar
- `src/pages` — Login ve ilk dashboard
- Token `localStorage` içinde tutulur; sayfa yenilenince `GET /api/auth/me` ile doğrulanır
