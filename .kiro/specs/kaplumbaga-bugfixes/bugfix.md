# Bugfix Requirements Document

## Introduction

Kaplumbağa chat uygulamasında iki kritik bug tespit edilmiştir:

1. **Mesaj Çevirisi Çalışmıyor**: Backend'de TranslationService aktif ve çeviri yapıyor ancak çeviri sonuçları veritabanına kaydedilmiyor ve kullanıcılara gösterilmiyor. Türkçe-Tayca mesajlar çevrilmeden orijinal haliyle görüntüleniyor.

2. **Video Görüşme Kamera Sorunu**: WebRTC bağlantısı başarıyla kuruluyor ve signaling çalışıyor ancak karşı tarafın video stream'i görüntülenmiyor. Kullanıcılar kamera izni veriyor ama karşı tarafın kamerası ekranda görünmüyor.

Bu bug'lar uygulamanın temel işlevlerini (çeviri ve video görüşme) kullanılamaz hale getirmektedir.

## Bug Analysis

### Current Behavior (Defect)

#### 1. Mesaj Çevirisi Bug'ı

1.1 WHEN bir kullanıcı Türkçe mesaj gönderdiğinde THEN backend TranslationService çeviri yapar ancak `translationProvider` alanı veritabanında mevcut olmadığı için çeviri bilgisi kaydedilmez

1.2 WHEN çeviri yapılmış bir mesaj frontend'e gönderildiğinde THEN `translationProvider` bilgisi eksik olduğu için mesaj çevrilmemiş gibi görüntülenir

1.3 WHEN Tayca mesaj gönderildiğinde THEN aynı şekilde çeviri bilgisi kaydedilmez ve Türkçe kullanıcı orijinal Tayca metni görür

1.4 WHEN veritabanından mesaj geçmişi yüklendiğinde THEN tüm mesajlar `translationProvider` bilgisi olmadan gelir ve çeviri durumu belirsiz kalır

#### 2. Video Görüşme Kamera Bug'ı

2.1 WHEN bir kullanıcı video görüşme başlattığında THEN WebRTC peer connection kurulur ve local stream başarıyla eklenir ancak remote video element `muted` attribute'u olmadığı için bazı tarayıcılarda autoplay engellenir

2.2 WHEN remote video stream `ontrack` event'i ile geldiğinde THEN stream `remoteVideoRef.current.srcObject`'e atanır ancak video element autoplay yapamaz ve karşı tarafın kamerası görünmez

2.3 WHEN kullanıcı kendi kamerasını açtığında THEN local video görünür ancak karşı taraf kullanıcının kamerasını göremez

2.4 WHEN Android APK'da video görüşme yapıldığında THEN mobil tarayıcılar autoplay için `muted` attribute'u zorunlu kılar ve remote video hiç oynatılmaz

### Expected Behavior (Correct)

#### 1. Mesaj Çevirisi Düzeltmesi

2.1 WHEN bir kullanıcı Türkçe mesaj gönderdiğinde THEN backend TranslationService çeviri yapar VE `translationProvider` bilgisi (local/mymemory/libretranslate) veritabanına kaydedilir

2.2 WHEN çeviri yapılmış bir mesaj frontend'e gönderildiğinde THEN mesaj hem `originalText` hem `translatedText` hem de `provider` bilgisi ile birlikte gelir ve kullanıcı çevrilmiş metni görür

2.3 WHEN Tayca mesaj gönderildiğinde THEN çeviri Türkçe'ye yapılır, provider bilgisi kaydedilir ve Türkçe kullanıcı çevrilmiş metni görür

2.4 WHEN veritabanından mesaj geçmişi yüklendiğinde THEN tüm mesajlar `translationProvider` bilgisi ile birlikte gelir ve hangi provider'ın kullanıldığı bilinir

2.5 WHEN çeviri başarısız olduğunda (fallback durumu) THEN `provider: 'fallback'` olarak kaydedilir ve kullanıcı orijinal metni görür

#### 2. Video Görüşme Kamera Düzeltmesi

2.6 WHEN bir kullanıcı video görüşme başlattığında THEN remote video element `muted` attribute'u ile render edilir ve tarayıcı autoplay'e izin verir

2.7 WHEN remote video stream `ontrack` event'i ile geldiğinde THEN stream `remoteVideoRef.current.srcObject`'e atanır VE video element otomatik olarak oynatılır ve karşı tarafın kamerası görünür

2.8 WHEN kullanıcı kendi kamerasını açtığında THEN hem local video görünür hem de karşı taraf kullanıcının kamerasını görür

2.9 WHEN Android APK'da video görüşme yapıldığında THEN remote video `muted` attribute'u sayesinde autoplay çalışır ve karşı tarafın kamerası mobil cihazda görünür

2.10 WHEN kullanıcı mikrofonu kapatıp açtığında THEN remote video'nun `muted` attribute'u değişmez (sadece local audio track enable/disable olur) ve video oynatılmaya devam eder

### Unchanged Behavior (Regression Prevention)

#### 1. Mesaj Çevirisi - Korunması Gereken Davranışlar

3.1 WHEN bir kullanıcı resim gönderdiğinde THEN resim mesajları çeviri yapılmadan `type: 'image'` olarak kaydedilmeye devam eder

3.2 WHEN aynı dilde iki kullanıcı mesajlaştığında (tr-tr veya th-th) THEN çeviri yapılmaz ve `provider: 'local'` olarak kaydedilir

3.3 WHEN TranslationService sırasıyla local dictionary, MyMemory API ve LibreTranslate API'yi denediğinde THEN bu fallback chain değişmeden çalışmaya devam eder

3.4 WHEN bir mesaj gönderildiğinde THEN `deliveryStatus` (sent/delivered/read) mantığı değişmeden çalışmaya devam eder

3.5 WHEN mesaj geçmişi yüklendiğinde THEN mevcut mesajların `originalText`, `translatedText`, `sourceLang`, `targetLang` alanları değişmeden gelmeye devam eder

3.6 WHEN Socket.IO üzerinden mesaj gönderildiğinde THEN `send_message` ve `receive_message` event'leri aynı şekilde çalışmaya devam eder

#### 2. Video Görüşme - Korunması Gereken Davranışlar

3.7 WHEN bir kullanıcı video görüşme başlattığında THEN WebRTC peer connection kurulumu, ICE candidate exchange ve signaling süreci değişmeden çalışmaya devam eder

3.8 WHEN local video stream oluşturulduğunda THEN `getUserMedia` ile kamera ve mikrofon izni alınmaya devam eder

3.9 WHEN kullanıcı mikrofonu kapatıp açtığında THEN audio track'lerin `enabled` property'si toggle edilmeye devam eder

3.10 WHEN kullanıcı kamerayı kapatıp açtığında THEN video track'lerin `enabled` property'si toggle edilmeye devam eder

3.11 WHEN kullanıcı görüşmeyi sonlandırdığında THEN peer connection kapatılır, stream'ler durdurulur ve `end_call` event'i gönderilmeye devam eder

3.12 WHEN local video görüntülendiğinde THEN `localVideoRef` element'i `muted` attribute'u ile render edilmeye devam eder (kendi sesini duymaması için)

3.13 WHEN video görüşme sırasında connection state değiştiğinde THEN `onconnectionstatechange` handler'ı çalışmaya ve call state'i güncellemeye devam eder

3.14 WHEN STUN/TURN server'ları yapılandırıldığında THEN `getIceServers()` fonksiyonu aynı server listesini döndürmeye devam eder
