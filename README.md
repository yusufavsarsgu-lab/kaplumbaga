# KAPLUMBAĞA

KAPLUMBAĞA, Türkiye'deki Yusuf ile Tayland'daki Neeja'nın özel kullanımı için geliştirilen Türkçe ↔ Tayca çeviri destekli mesajlaşma ve görüntülü konuşma uygulamasıdır.

Frontend React, Vite, TypeScript, Tailwind CSS, Zustand, socket.io-client, WebRTC ve Capacitor ile çalışır. Backend Node.js, Express, TypeScript, Socket.IO, Prisma, bcrypt, JWT ve TranslationService kullanır.

## Özellikler

- Yusuf ve Neeja için hashli şifreli gerçek giriş akışı
- JWT tabanlı oturum sistemi
- Prisma ile kalıcı kullanıcı, mesaj ve arama kaydı
- Socket.IO ile token doğrulamalı anlık mesajlaşma
- Türkçe ↔ Tayca yerel çeviri sözlüğü ve gerçek çeviri sağlayıcılarına uygun servis yapısı
- Kullanıcı diline göre Türkçe/Tayca arayüz
- Mesajın orijinal ve çevrilmiş halini saklama
- Mesaj durumları: gönderildi, iletildi, okundu
- Hızlı mesajlar, emoji ekleme, resim seçme/önizleme/gönderme
- Mobil ve masaüstü uyumlu özel sohbet arayüzü
- WebRTC görüntülü görüşme, kamera/mikrofon kontrolü ve PiP video ekranı
- Render backend, Netlify frontend ve Android APK üretim akışı

## İlk Kullanıcılar

- Yusuf / 123456 / Türkçe
- Neeja / 123456 / Tayca

Bu iki kullanıcı Prisma seed sırasında oluşturulur. Şifreler veritabanına bcrypt hash olarak kaydedilir.

## Güvenlik

- Üretim ortamında `JWT_SECRET` güçlü, rastgele ve gizli tutulmalıdır.
- Şifreler bcrypt ile hashlenir; düz metin kullanıcı dosyası kullanılmaz.
- Gerçek çeviri API anahtarları yalnızca `.env` veya platform environment variables içinde tutulmalıdır.
- Base64 resim akışı küçük resimler için uygundur; yüksek hacimli kullanımda Cloudinary, S3 veya Firebase Storage kullanılmalıdır.
- WebRTC için HTTPS zorunludur. TURN sunucusu yoksa bazı uzak ağlarda görüntülü konuşma bağlantısı kurulamayabilir.

## Backend Kurulum

```bash
cd backend
npm install
```

Ortam dosyası:

```powershell
Copy-Item .env.example .env
```

Veritabanı ve ilk kullanıcılar:

```powershell
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

## Frontend Kurulum

```bash
cd frontend
npm install
```

Ortam dosyası:

```powershell
Copy-Item .env.example .env
```

## Lokal Çalıştırma

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Tarayıcı adresi:

```text
http://localhost:5173
```

API sağlık kontrolü:

```text
http://localhost:4000/health
```

## Build ve Kontrol

Backend:

```bash
cd backend
npm run typecheck
npm run build
npm run start
```

Frontend:

```bash
cd frontend
npm run typecheck
npm run build
npm run preview
```

Android sync:

```bash
cd frontend
npx cap sync android
```

## GitHub

```bash
git init
git add .
git commit -m "Initial KAPLUMBAĞA app"
git branch -M main
git remote add origin GITHUB_REPO_URL
git push -u origin main
```

## Render Backend

Render ayarları:

- Root Directory: `backend`
- Build Command: `npm install && npm run build:render`
- Start Command: `npm run start`
- Environment Variables:
  - `PORT=4000`
  - `NODE_ENV=production`
  - `CLIENT_URL=https://kaplumbaga-chat.netlify.app`
  - `DATABASE_URL=Render PostgreSQL connection string`
  - `JWT_SECRET=güçlü-rastgele-değer`
  - `TRANSLATION_PROVIDER=local`
  - `OPENAI_API_KEY=` veya `GOOGLE_TRANSLATE_API_KEY=` gerektiğinde
  - `OPENAI_TRANSLATION_MODEL=gpt-4o-mini`
  - `SEED_YUSUF_PASSWORD=123456`
  - `SEED_NEEJA_PASSWORD=123456`

`build:render` komutu PostgreSQL şeması için Prisma Client üretir, veritabanı şemasını Render PostgreSQL ile eşitler ve ilk kullanıcıları seed eder.

## Netlify Frontend

Netlify ayarları:

- Base Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variables:
  - `VITE_API_URL=https://RENDER-BACKEND-ADRESI.onrender.com`
  - `VITE_SOCKET_URL=https://RENDER-BACKEND-ADRESI.onrender.com`
  - `VITE_TURN_URL=`
  - `VITE_TURN_USERNAME=`
  - `VITE_TURN_CREDENTIAL=`

SPA yönlendirme `frontend/netlify.toml` ve `frontend/public/_redirects` ile tanımlıdır.

## APK

Debug APK üretmek için:

```bash
cd frontend
npm run android:build
```

APK çıktısı:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

APK almadan önce `VITE_API_URL` ve `VITE_SOCKET_URL` canlı Render backend adresini göstermelidir.
