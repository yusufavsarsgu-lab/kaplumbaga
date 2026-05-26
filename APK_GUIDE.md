# KAPLUMBAĞA APK Guide

KAPLUMBAĞA frontend'i Capacitor ile Android APK üretecek şekilde yapılandırılmıştır.

## Android Yapılandırması

- App ID: `com.kaplumbaga.chat`
- App Name: `KAPLUMBAĞA`
- Web Directory: `dist`
- Android klasörü: `frontend/android`

Android izinleri:

- `android.permission.INTERNET`
- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`
- `android.permission.READ_MEDIA_IMAGES`
- `android.permission.READ_EXTERNAL_STORAGE` (`maxSdkVersion=32`)

## APK Üretimi

```bash
cd frontend
npm install
npm run android:build
```

APK çıktısı:

```text
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Android Studio ile almak için:

```bash
cd frontend
npx cap open android
```

Android Studio içinde:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

## Canlı Backend Ayarı

APK üretmeden önce frontend ortam değişkenleri canlı Render backend adresini göstermelidir:

```text
VITE_API_URL=https://RENDER-BACKEND-ADRESI.onrender.com
VITE_SOCKET_URL=https://RENDER-BACKEND-ADRESI.onrender.com
```

Görüntülü arama için TURN kullanılıyorsa:

```text
VITE_TURN_URL=turn:TURN-SERVER:3478
VITE_TURN_USERNAME=TURN-KULLANICI
VITE_TURN_CREDENTIAL=TURN-SIFRE
```

## Sync

Web build'i Android projesine kopyalamak için:

```bash
cd frontend
npx cap sync android
```

## Notlar

- API anahtarları mobil bundle içine yazılmamalıdır; çeviri sağlayıcıları backend üzerinden yönetilmelidir.
- Base64 resim akışı küçük resimler için uygundur; yoğun kullanımda storage servisi kullanılmalıdır.
- TURN sunucusu yoksa bazı ağlarda görüntülü arama bağlantısı kurulamayabilir.
