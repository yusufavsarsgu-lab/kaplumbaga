# KAPLUMBAĞA

KAPLUMBAĞA, Türkiye'deki Yusuf ile Tayland'daki Neeja'nın özel kullanımı için hazırlanmış Türkçe ↔ Tayca otomatik çeviri destekli mesajlaşma ve görüntülü konuşma uygulamasıdır.

Frontend React, Vite, TypeScript, Tailwind CSS, Zustand ve socket.io-client ile; backend Node.js, Express, TypeScript, Socket.IO, CORS, users.json ve TranslationService ile hazırlanmıştır.

## Özellikler

- Yusuf ve Neeja için demo giriş sistemi
- Socket.IO ile anlık mesajlaşma
- Türkçe ↔ Tayca demo çeviri servisi
- Mesajın orijinal ve çevrilmiş halini saklama
- Hızlı mesajlar, emoji ekleme ve resim önizleme/gönderme
- Mobil ve masaüstü uyumlu WhatsApp benzeri özel chat arayüzü
- Kamera/mikrofon izinli demo görüntülü görüşme ekranı
- Ayarların localStorage'a kaydedilmesi
- Render backend ve Netlify frontend deploy hazırlığı
- Capacitor Android APK altyapısı

## Kullanıcı Giriş Bilgileri

- Yusuf / 123456 / Türkçe
- Neeja / 123456 / Tayca

## Güvenlik Notu

- Demo kullanıcı şifreleri gerçek üretim için güvenli değildir.
- Gerçek kullanımda şifreler hashlenmeli.
- JWT veya session güvenliği eklenmeli.
- Resim yükleme için güvenli storage kullanılmalı.
- Gerçek çeviri API anahtarları `.env` içinde tutulmalı ve GitHub'a gönderilmemeli.
- Mesajlar kalıcı olacaksa güvenli bir veritabanı ve erişim kuralları eklenmeli.

## Backend Kurulum

```bash
cd backend
npm install
```

Backend ortam dosyası:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Frontend Kurulum

```bash
cd frontend
npm install
```

Frontend ortam dosyası:

```bash
cp .env.example .env
```

Windows PowerShell:

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

## Build ve Typecheck

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

## GitHub'a Gönderme

```bash
git init
git add .
git commit -m "Initial KAPLUMBAĞA app"
git branch -M main
git remote add origin GITHUB_REPO_URL
git push -u origin main
```

## Render Deploy

Backend için Render ayarları:

- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Environment Variables:
  - `PORT=4000`
  - `CLIENT_URL=https://NETLIFY-SITE-ADRESI.netlify.app`
  - `NODE_ENV=production`

Repo kökünde `render.yaml` dosyası hazırdır.

## Netlify Deploy

Frontend için Netlify ayarları:

- Base Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variables:
  - `VITE_API_URL=https://RENDER-BACKEND-ADRESI.onrender.com`
  - `VITE_SOCKET_URL=https://RENDER-BACKEND-ADRESI.onrender.com`

SPA yönlendirme için `frontend/netlify.toml` ve `frontend/public/_redirects` hazırdır.

## APK İçin Sonraki Yol

APK için Capacitor altyapısı hazırdır.

```bash
cd frontend
npm install
npm run android:build
```

Debug APK çıktısı:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Üretim APK almadan önce `VITE_API_URL` ve `VITE_SOCKET_URL` gerçek Render backend adresini göstermelidir.

Detaylar için `APK_GUIDE.md` dosyasına bakın.
