# KAPLUMBAĞA APK Guide

KAPLUMBAĞA frontend'i APK'ye çevirmek için Capacitor altyapısı projeye eklenmiştir.

## Hazır Komutlar

Debug APK üretmek için:

```bash
cd frontend
npm install
npm run android:build
```

APK çıktısı:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Android projesini Android Studio ile açmak için:

```bash
npx cap open android
```

Sadece web build'i Android projesine kopyalamak için:

```bash
npm run android:sync
```

## Üretim Backend Ayarı

APK almadan önce gerçek Render backend adresi frontend env içinde verilmelidir:

```bash
VITE_API_URL=https://RENDER-BACKEND-ADRESI.onrender.com
VITE_SOCKET_URL=https://RENDER-BACKEND-ADRESI.onrender.com
```

## Gerekli Mobil İzinler

Android tarafında kamera ve mikrofon izinleri eklenmelidir:

- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`
- Gerekirse medya seçimi için Android sürümüne uygun fotoğraf izinleri

## Üretim Notları

- Mobil uygulamada `VITE_API_URL` ve `VITE_SOCKET_URL` Render backend adresini göstermelidir.
- Gerçek WebRTC yapılacaksa TURN/STUN sunucuları eklenmelidir.
- Resimler için güvenli storage servisi kullanılmalıdır.
- API anahtarları mobil bundle içine gömülmemeli, backend üzerinden yönetilmelidir.
