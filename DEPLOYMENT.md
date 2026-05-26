# KAPLUMBAĞA Deployment Guide

Bu dosya GitHub, Render ve Netlify yayın adımlarını netleştirir.

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
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Environment Variables:
  - `PORT=4000`
  - `CLIENT_URL=https://NETLIFY-SITE-ADRESI.netlify.app`
  - `NODE_ENV=production`

Render sağlık kontrolü:

```text
https://RENDER-BACKEND-ADRESI.onrender.com/health
```

Beklenen cevap:

```json
{ "status": "ok", "service": "kaplumbaga-api" }
```

## Netlify Frontend

Netlify ayarları:

- Base Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variables:
  - `VITE_API_URL=https://RENDER-BACKEND-ADRESI.onrender.com`
  - `VITE_SOCKET_URL=https://RENDER-BACKEND-ADRESI.onrender.com`

SPA redirect:

- `frontend/netlify.toml` içinde redirect tanımı var.
- `frontend/public/_redirects` dosyası da Netlify için hazır.

## Yayın Sırası

1. Projeyi GitHub'a gönder.
2. Backend'i Render'da yayınla.
3. Render URL'ini Netlify environment değişkenlerine ekle.
4. Netlify frontend'i yayınla.
5. Netlify URL'ini Render `CLIENT_URL` değişkenine ekle.
6. Backend ve frontend'i yeniden deploy et.
