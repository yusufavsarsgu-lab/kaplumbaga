# KAPLUMBAĞA Deployment Guide

Bu dosya GitHub, Render, Netlify ve Android yayın akışını açıklar.

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

Environment Variables:

- `PORT=4000`
- `NODE_ENV=production`
- `CLIENT_URL=https://kaplumbaga-chat.netlify.app`
- `DATABASE_URL=Render PostgreSQL connection string`
- `JWT_SECRET=güçlü-rastgele-değer`
- `TRANSLATION_PROVIDER=local`
- `OPENAI_API_KEY=`
- `OPENAI_TRANSLATION_MODEL=gpt-4o-mini`
- `GOOGLE_TRANSLATE_API_KEY=`
- `SEED_YUSUF_PASSWORD=123456`
- `SEED_NEEJA_PASSWORD=123456`

Sağlık kontrolü:

```text
https://RENDER-BACKEND-ADRESI.onrender.com/health
```

Beklenen cevap:

```json
{ "status": "ok", "service": "kaplumbaga-api" }
```

Render PostgreSQL şeması `backend/prisma/schema.postgresql.prisma` ile çalışır. Build sırasında Prisma Client bu şemadan üretilir, `prisma db push` ile canlı veritabanına uygulanır ve ilk kullanıcılar seed edilir.

## Netlify Frontend

Netlify ayarları:

- Base Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Environment Variables:

- `VITE_API_URL=https://RENDER-BACKEND-ADRESI.onrender.com`
- `VITE_SOCKET_URL=https://RENDER-BACKEND-ADRESI.onrender.com`
- `VITE_TURN_URL=`
- `VITE_TURN_USERNAME=`
- `VITE_TURN_CREDENTIAL=`

SPA redirect:

- `frontend/netlify.toml`
- `frontend/public/_redirects`

## Yayın Sırası

1. Projeyi GitHub'a gönder.
2. Render'da PostgreSQL veritabanı oluştur.
3. Backend'i Render'da yayınla.
4. Render backend URL'ini Netlify environment değişkenlerine ekle.
5. Frontend'i Netlify'da yayınla.
6. Netlify URL'ini Render `CLIENT_URL` değişkenine ekle.
7. Backend ve frontend deploylarını yeniden çalıştır.
8. `/health`, login, mesajlaşma, resim gönderme ve görüntülü arama akışlarını canlı URL üzerinden test et.

## WebRTC

WebRTC tarayıcıda HTTPS ister. STUN varsayılan olarak açıktır:

```text
stun:stun.l.google.com:19302
```

Farklı mobil operatörler veya katı ağlarda TURN sunucusu gerekir. TURN bilgileri Netlify env üzerinden verilir:

```text
VITE_TURN_URL
VITE_TURN_USERNAME
VITE_TURN_CREDENTIAL
```
