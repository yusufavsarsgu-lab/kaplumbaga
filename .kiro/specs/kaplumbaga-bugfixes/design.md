# Kaplumbağa Bugfixes Teknik Tasarım

## Overview

Bu doküman Kaplumbağa chat uygulamasındaki iki kritik bug'ın düzeltilmesi için teknik tasarım içerir:

1. **Mesaj Çevirisi Bug'ı**: TranslationService çeviri yapıyor ancak `translationProvider` bilgisi veritabanına kaydedilmiyor. Bu bug, hangi çeviri provider'ının kullanıldığının (local/mymemory/libretranslate/fallback) bilinmemesine ve frontend'de çeviri durumunun belirsiz kalmasına neden oluyor.

2. **Video Görüşme Kamera Bug'ı**: WebRTC bağlantısı başarıyla kuruluyor ancak remote video element'inde `muted` attribute'u olmadığı için tarayıcılar autoplay'i engelliyor ve karşı tarafın kamerası görünmüyor.

Her iki bug da uygulamanın temel işlevlerini (çeviri ve video görüşme) kullanılamaz hale getirmektedir. Bu tasarım, bug'ların minimal değişikliklerle düzeltilmesini ve mevcut davranışların korunmasını hedefler.

## Glossary

### Bug 1: Mesaj Çevirisi
- **Bug_Condition (C)**: Bir mesaj gönderildiğinde ve TranslationService bir provider kullanarak çeviri yaptığında
- **Property (P)**: Çeviri sonucundaki `provider` bilgisinin veritabanına kaydedilmesi ve frontend'e iletilmesi
- **Preservation**: Mevcut çeviri mantığı (local → mymemory → libretranslate fallback chain), mesaj gönderme/alma akışı, Socket.IO event'leri
- **TranslationService**: `backend/src/services/TranslationService.ts` - Çeviri yapan servis, `TranslationOutcome` döndürür
- **translationProvider**: Yeni eklenecek veritabanı alanı - hangi provider'ın kullanıldığını saklar ('local' | 'mymemory' | 'libretranslate' | 'fallback')
- **Message Model**: Prisma schema'daki mesaj modeli - `originalText`, `translatedText`, `translationStatus` alanlarını içerir
- **ChatMessage**: Frontend'e gönderilen mesaj tipi - `toChatMessage()` fonksiyonu ile oluşturulur

### Bug 2: Video Görüşme
- **Bug_Condition (C)**: Remote video stream `ontrack` event'i ile geldiğinde ve `remoteVideoRef.current.srcObject`'e atandığında
- **Property (P)**: Remote video element'inin `muted` attribute'u ile render edilmesi ve autoplay'in çalışması
- **Preservation**: WebRTC peer connection kurulumu, ICE candidate exchange, signaling, local video rendering, mikrofon/kamera toggle mantığı
- **remoteVideoRef**: React ref - karşı tarafın video stream'ini gösteren `<video>` element'ine referans
- **autoplay**: HTML5 video attribute - video'nun otomatik oynatılmasını sağlar, ancak `muted` olmadan bazı tarayıcılarda engellenir
- **VideoCallPage**: `frontend/src/pages/VideoCallPage.tsx` - Tam ekran video görüşme sayfası
- **VideoCallOverlay**: `frontend/src/components/VideoCallOverlay.tsx` - Chat sayfasında overlay olarak gösterilen video görüşme bileşeni


## Bug Details

### Bug 1: Mesaj Çevirisi - Bug Condition

Mesaj gönderildiğinde TranslationService çeviri yapar ve `TranslationOutcome` döndürür. Bu outcome `provider` bilgisi içerir ancak bu bilgi veritabanına kaydedilmez. Backend'de `send_message` handler'ı çeviri sonucunu alır, ancak Prisma Message modelinde `translationProvider` alanı olmadığı için bu bilgi kaybolur.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { message: Message, translationOutcome: TranslationOutcome }
  OUTPUT: boolean
  
  RETURN input.message.type == 'text'
         AND input.translationOutcome.provider IN ['local', 'mymemory', 'libretranslate', 'fallback']
         AND NOT database.hasField('Message.translationProvider')
         AND input.translationOutcome.provider NOT savedToDatabase
END FUNCTION
```

**Mevcut Kod Akışı:**
1. `socket.on('send_message')` handler çağrılır
2. `translateText()` fonksiyonu `TranslationOutcome` döndürür (içinde `provider` var)
3. `prisma.message.create()` çağrılır ancak `translationProvider` alanı yok
4. `toChatMessage()` ile `ChatMessage` oluşturulur
5. `chatMessage.provider` manuel olarak atanır ama veritabanında kayıtlı değil
6. Frontend mesajı alır ama mesaj geçmişi yüklendiğinde `provider` bilgisi kayıp

### Bug 1: Mesaj Çevirisi - Examples

**Örnek 1: Local Dictionary Çevirisi**
- Kullanıcı "Seni seviyorum" gönderir
- TranslationService local dictionary'den bulur, `provider: 'local'` döndürür
- Veritabanına kaydedilir ama `translationProvider` alanı yok
- Frontend mesajı alır, `provider` bilgisi var (Socket.IO'dan geldi)
- Sayfa yenilenir, mesaj geçmişi yüklenir, `provider` bilgisi kayıp

**Örnek 2: MyMemory API Çevirisi**
- Kullanıcı "Bugün hava güzel" gönderir
- Local dictionary bulamaz, MyMemory API çevirir, `provider: 'mymemory'` döndürür
- Veritabanına kaydedilir ama `translationProvider` alanı yok
- Frontend mesajı alır, `provider` bilgisi var
- Sayfa yenilenir, hangi API'nin kullanıldığı bilinmez

**Örnek 3: Fallback Durumu**
- Kullanıcı bilinmeyen kelime gönderir, tüm API'ler başarısız
- `provider: 'fallback'` döndürür
- Veritabanına kaydedilir ama `translationProvider` alanı yok
- Frontend mesajı alır, fallback olduğunu bilir
- Sayfa yenilenir, çeviri başarısız olduğu bilgisi kayıp

**Örnek 4: Resim Mesajı (Edge Case)**
- Kullanıcı resim gönderir
- `type: 'image'`, çeviri yapılmaz, `provider: 'local'` olarak işaretlenir
- Veritabanına kaydedilir ama `translationProvider` alanı yok
- Bu durumda da provider bilgisi kaybolur


### Bug 2: Video Görüşme - Bug Condition

Remote video stream `ontrack` event'i ile geldiğinde `remoteVideoRef.current.srcObject`'e atanır. Video element `autoPlay` ve `playsInline` attribute'larına sahip ancak `muted` attribute'u yok. Modern tarayıcılar (özellikle mobil) autoplay için `muted` attribute'unu zorunlu kılar. Bu olmadan video otomatik oynatılmaz ve karşı tarafın kamerası görünmez.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { videoElement: HTMLVideoElement, stream: MediaStream }
  OUTPUT: boolean
  
  RETURN input.videoElement.autoPlay == true
         AND input.videoElement.playsInline == true
         AND input.videoElement.muted == false
         AND input.stream.getVideoTracks().length > 0
         AND browserBlocksAutoplay(input.videoElement)
END FUNCTION
```

**Mevcut Kod Akışı:**
1. WebRTC peer connection kurulur
2. `pc.ontrack` event handler çağrılır
3. `remoteVideoRef.current.srcObject = event.streams[0]` atanır
4. Video element `autoPlay` ve `playsInline` var ama `muted` yok
5. Tarayıcı autoplay'i engeller (özellikle mobil)
6. Kullanıcı karşı tarafın kamerasını göremez

### Bug 2: Video Görüşme - Examples

**Örnek 1: Desktop Chrome**
- Kullanıcı video görüşme başlatır
- Local video görünür (zaten `muted`)
- Remote stream gelir, `srcObject`'e atanır
- Chrome autoplay'e izin verir (bazen), video oynar
- Ancak bazı durumlarda (user gesture olmadan) engeller

**Örnek 2: Mobile Safari (iOS)**
- Kullanıcı video görüşme başlatır
- Local video görünür
- Remote stream gelir, `srcObject`'e atanır
- Safari `muted` olmadan autoplay'e izin vermez
- Video oynatılmaz, karşı taraf görünmez

**Örnek 3: Android WebView (APK)**
- Kullanıcı APK'da video görüşme başlatır
- Local video görünür
- Remote stream gelir, `srcObject`'e atanır
- Android WebView `muted` attribute'u zorunlu kılar
- Video oynatılmaz, karşı taraf görünmez

**Örnek 4: VideoCallOverlay Mini Mode**
- Kullanıcı chat yaparken video görüşme başlatır
- Overlay mini mode'da açılır
- Remote stream gelir, `srcObject`'e atanır
- Aynı bug, mini mode'da da video oynatılmaz


## Expected Behavior

### Bug 1: Mesaj Çevirisi - Preservation Requirements

**Unchanged Behaviors:**
- TranslationService'in fallback chain mantığı (local → mymemory → libretranslate → fallback) değişmeden çalışmalı
- `translateText()` ve `autoTranslate()` fonksiyonları aynı şekilde çalışmalı
- Socket.IO `send_message` ve `receive_message` event'leri aynı payload yapısını korumalı
- Mesaj gönderme/alma akışı değişmemeli
- `deliveryStatus` (sent/delivered/read) mantığı değişmemeli
- Resim mesajları (`type: 'image'`) çeviri yapılmadan kaydedilmeye devam etmeli
- Aynı dilde mesajlaşma (tr-tr, th-th) çeviri yapılmadan `provider: 'local'` olarak işaretlenmeli
- `toChatMessage()` fonksiyonu aynı şekilde çalışmalı

**Scope:**
Sadece `translationProvider` alanı eklenecek. Mevcut `originalText`, `translatedText`, `sourceLang`, `targetLang`, `translationStatus` alanları değişmeyecek. TranslationService'in iç mantığı değişmeyecek, sadece döndürdüğü `provider` bilgisi veritabanına kaydedilecek.

### Bug 2: Video Görüşme - Preservation Requirements

**Unchanged Behaviors:**
- WebRTC peer connection kurulumu aynı şekilde çalışmalı
- ICE candidate exchange ve signaling süreci değişmemeli
- `getUserMedia` ile kamera/mikrofon izni alınması değişmemeli
- Local video rendering değişmemeli (zaten `muted`)
- Mikrofon toggle (`toggleMic`) mantığı değişmemeli - audio track'lerin `enabled` property'si toggle edilmeli
- Kamera toggle (`toggleCam`) mantığı değişmemeli - video track'lerin `enabled` property'si toggle edilmeli
- Görüşme sonlandırma (`endCall`) mantığı değişmemeli
- `onconnectionstatechange` handler'ı aynı şekilde çalışmalı
- STUN/TURN server yapılandırması değişmemeli
- VideoCallOverlay'in mini/full mode toggle mantığı değişmemeli

**Scope:**
Sadece remote video element'ine `muted` attribute'u eklenecek. Local video zaten `muted`, bu değişmeyecek. Remote video'nun `muted` olması ses çıkışını etkilemez çünkü WebRTC audio track'leri ayrı yönetilir. Kullanıcı mikrofonu kapatıp açtığında remote video'nun `muted` attribute'u değişmez, sadece local audio track enable/disable olur.


## Hypothesized Root Cause

### Bug 1: Mesaj Çevirisi

**Root Cause Analysis:**

1. **Schema Eksikliği**: Prisma Message modelinde `translationProvider` alanı tanımlanmamış. TranslationService `provider` bilgisi döndürüyor ancak bu bilgi veritabanına kaydedilemiyor.

2. **Backend Kayıt Eksikliği**: `send_message` handler'ında `prisma.message.create()` çağrısında `translationProvider` alanı yok. `translation.provider` bilgisi mevcut ancak veritabanına yazılmıyor.

3. **Frontend Geçici Çözüm**: Backend `toChatMessage()` fonksiyonundan sonra `chatMessage.provider` manuel olarak atıyor. Bu Socket.IO üzerinden gönderilen mesajlar için çalışıyor ancak veritabanından yüklenen mesajlar için çalışmıyor.

4. **Mesaj Geçmişi Sorunu**: Kullanıcı sayfa yenilediğinde veya uygulama yeniden başladığında mesaj geçmişi veritabanından yükleniyor. `translationProvider` alanı olmadığı için hangi provider'ın kullanıldığı bilinmiyor.

**Doğrulama:**
- Prisma schema'da `Message` modelini kontrol et → `translationProvider` alanı yok ✓
- `send_message` handler'ında `prisma.message.create()` çağrısını kontrol et → `translationProvider` kaydedilmiyor ✓
- `toChatMessage()` fonksiyonunu kontrol et → `provider` bilgisi döndürülmüyor ✓
- Frontend mesaj geçmişi yükleme kodunu kontrol et → `provider` bilgisi eksik ✓

### Bug 2: Video Görüşme

**Root Cause Analysis:**

1. **Autoplay Policy**: Modern tarayıcılar (özellikle Chrome 66+, Safari 11+) autoplay policy'si ile video'ların otomatik oynatılmasını kısıtlar. `muted` attribute'u olmadan autoplay'e izin vermez.

2. **Mobile Restrictions**: Mobil tarayıcılar (iOS Safari, Android Chrome) daha katı autoplay kuralları uygular. Remote video için `muted` attribute'u zorunludur.

3. **WebView Restrictions**: Android APK'da kullanılan WebView, autoplay için `muted` attribute'unu zorunlu kılar. Bu olmadan video oynatılmaz.

4. **Local vs Remote Video**: Local video zaten `muted` attribute'una sahip (kullanıcı kendi sesini duymaması için). Ancak remote video için `muted` attribute'u eklenmemiş.

**Doğrulama:**
- VideoCallPage.tsx'de remote video element'ini kontrol et → `muted` attribute'u yok ✓
- VideoCallOverlay.tsx'de remote video element'ini kontrol et → `muted` attribute'u yok ✓
- Local video element'ini kontrol et → `muted` attribute'u var ✓
- Tarayıcı autoplay policy'sini kontrol et → `muted` olmadan engelleniyor ✓


## Correctness Properties

Property 1: Bug Condition - Translation Provider Persistence

_For any_ text message where TranslationService returns a `TranslationOutcome` with a `provider` value (local/mymemory/libretranslate/fallback), the fixed system SHALL save the `provider` value to the database `translationProvider` field and include it in the `ChatMessage` sent to the frontend, ensuring the translation source is preserved across sessions.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Translation Service Behavior

_For any_ message where the translation process is invoked, the fixed system SHALL produce the same translation results as the original system, preserving the fallback chain (local → mymemory → libretranslate → fallback), the same `originalText`, `translatedText`, `sourceLang`, `targetLang`, and `translationStatus` values, with only the addition of the `translationProvider` field.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Property 3: Bug Condition - Remote Video Autoplay

_For any_ video call where a remote video stream is received via the `ontrack` event and assigned to `remoteVideoRef.current.srcObject`, the fixed system SHALL render the remote video element with the `muted` attribute set to true, allowing the browser to autoplay the video and display the remote user's camera feed.

**Validates: Requirements 2.6, 2.7, 2.8, 2.9**

Property 4: Preservation - WebRTC Connection Behavior

_For any_ video call where WebRTC peer connection, ICE candidate exchange, signaling, local video rendering, or audio/video track toggling occurs, the fixed system SHALL produce the same behavior as the original system, preserving all connection setup logic, event handlers, and user controls, with only the addition of the `muted` attribute to the remote video element.

**Validates: Requirements 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14**


## Fix Implementation

### Bug 1: Mesaj Çevirisi - Changes Required

Assuming our root cause analysis is correct:

**File 1**: `backend/prisma/schema.prisma`

**Model**: `Message`

**Specific Changes**:
1. **Add translationProvider Field**: `translationProvider` alanını ekle
   - Type: `String?` (nullable, mevcut mesajlar için)
   - Description: Hangi çeviri provider'ının kullanıldığını saklar
   - Values: 'local' | 'mymemory' | 'libretranslate' | 'fallback'
   - Placement: `translationStatus` alanından sonra

**File 2**: `backend/src/index.ts`

**Function**: `send_message` socket handler

**Specific Changes**:
1. **Save Provider to Database**: `prisma.message.create()` çağrısında `translationProvider` alanını ekle
   - Value: `translation.provider` (TranslationOutcome'dan gelir)
   - Placement: `translationStatus` alanından sonra

2. **Include Provider in ChatMessage**: `toChatMessage()` fonksiyonunu güncelle veya manuel atamayı koru
   - Mevcut kod zaten `chatMessage.provider = translation.provider` yapıyor
   - Bu mantık korunacak, ancak artık veritabanından da gelecek

**File 3**: `backend/src/index.ts` (veya ilgili dosya)

**Function**: `toChatMessage()` (eğer varsa)

**Specific Changes**:
1. **Include Provider in Conversion**: Veritabanından gelen `translationProvider` alanını `ChatMessage`'a ekle
   - Eğer `toChatMessage()` fonksiyonu varsa, `provider` alanını ekle
   - Eğer yoksa, mesaj geçmişi yükleme kodunda `provider` alanını ekle

**Migration**:
1. **Create Prisma Migration**: `npx prisma migrate dev --name add_translation_provider`
2. **Update Existing Messages**: Mevcut mesajlar için `translationProvider` null olacak (nullable field)
3. **Optional Backfill**: İsteğe bağlı olarak mevcut mesajları analiz edip provider bilgisi eklenebilir (opsiyonel)


### Bug 2: Video Görüşme - Changes Required

Assuming our root cause analysis is correct:

**File 1**: `frontend/src/pages/VideoCallPage.tsx`

**Component**: `VideoCallPage`

**Specific Changes**:
1. **Add muted Attribute to Remote Video**: Remote video element'ine `muted` attribute'u ekle
   - Location: Line 243-248 (remote video element)
   - Change: `<video ref={remoteVideoRef} autoPlay playsInline className="..." />`
   - To: `<video ref={remoteVideoRef} autoPlay playsInline muted className="..." />`
   - Reason: Tarayıcı autoplay policy'si için gerekli

**File 2**: `frontend/src/components/VideoCallOverlay.tsx`

**Component**: `VideoCallOverlay`

**Specific Changes**:
1. **Add muted Attribute to Remote Video**: Remote video element'ine `muted` attribute'u ekle
   - Location: Line 338-342 (remote video element)
   - Change: `<video ref={remoteVideoRef} autoPlay playsInline className="..." />`
   - To: `<video ref={remoteVideoRef} autoPlay playsInline muted className="..." />`
   - Reason: Tarayıcı autoplay policy'si için gerekli

**Important Notes**:
1. **Audio Not Affected**: Remote video'nun `muted` olması ses çıkışını etkilemez
   - WebRTC audio track'leri ayrı yönetilir
   - `muted` sadece HTML5 video element'inin ses çıkışını etkiler
   - WebRTC'de ses peer connection üzerinden gelir, video element'inden değil

2. **Local Video Already Muted**: Local video zaten `muted` attribute'una sahip
   - Kullanıcı kendi sesini duymaması için
   - Bu değişiklik sadece remote video için

3. **No JavaScript Changes**: JavaScript kodunda değişiklik yok
   - `ontrack` handler aynı kalır
   - `srcObject` atama aynı kalır
   - Sadece JSX'de `muted` attribute'u eklenir

4. **Cross-Platform Fix**: Bu değişiklik tüm platformlarda çalışır
   - Desktop Chrome/Firefox/Safari
   - Mobile iOS Safari
   - Mobile Android Chrome
   - Android APK WebView


## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Bug 1: Mesaj Çevirisi - Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that send messages with different translation providers and verify that the `translationProvider` field is missing in the database. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Local Dictionary Test**: Send "Seni seviyorum", verify local dictionary translates it, check database for `translationProvider` field (will be null/missing on unfixed code)
2. **MyMemory API Test**: Send "Bugün hava güzel", verify MyMemory API translates it, check database for `translationProvider` field (will be null/missing on unfixed code)
3. **LibreTranslate API Test**: Send a message that triggers LibreTranslate, check database for `translationProvider` field (will be null/missing on unfixed code)
4. **Fallback Test**: Send a message that triggers fallback, check database for `translationProvider` field (will be null/missing on unfixed code)
5. **Message History Test**: Send a message, reload the page, verify `provider` information is lost (will fail on unfixed code)

**Expected Counterexamples**:
- Database queries show `translationProvider` field does not exist in Message table
- Messages sent via Socket.IO have `provider` field (temporary)
- Messages loaded from database do not have `provider` field
- Possible causes: schema missing field, backend not saving field, frontend not receiving field from database

### Bug 1: Mesaj Çevirisi - Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (text messages with translation), the fixed function saves the `translationProvider` field to the database.

**Pseudocode:**
```
FOR ALL message WHERE message.type == 'text' AND translationOccurred(message) DO
  result := sendMessage_fixed(message)
  dbRecord := database.getMessage(result.id)
  ASSERT dbRecord.translationProvider IN ['local', 'mymemory', 'libretranslate', 'fallback']
  ASSERT dbRecord.translationProvider == result.provider
END FOR
```


### Bug 1: Mesaj Çevirisi - Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (image messages, same-language messages), or for all translation behavior, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL message WHERE message.type == 'image' OR message.sourceLang == message.targetLang DO
  ASSERT sendMessage_original(message).translatedText == sendMessage_fixed(message).translatedText
  ASSERT sendMessage_original(message).translationStatus == sendMessage_fixed(message).translationStatus
END FOR

FOR ALL message WHERE message.type == 'text' DO
  original := sendMessage_original(message)
  fixed := sendMessage_fixed(message)
  ASSERT original.originalText == fixed.originalText
  ASSERT original.translatedText == fixed.translatedText
  ASSERT original.sourceLang == fixed.sourceLang
  ASSERT original.targetLang == fixed.targetLang
  ASSERT original.translationStatus == fixed.translationStatus
  // Only difference: fixed has translationProvider field
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for image messages and same-language messages, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Image Message Preservation**: Send image messages, verify they are not translated and work the same way after fix
2. **Same Language Preservation**: Send tr-tr or th-th messages, verify no translation occurs and behavior is unchanged
3. **Translation Chain Preservation**: Send messages that trigger local → mymemory → libretranslate fallback, verify the chain works the same way
4. **Socket.IO Event Preservation**: Verify `send_message` and `receive_message` events have the same payload structure
5. **Delivery Status Preservation**: Verify `deliveryStatus` (sent/delivered/read) works the same way


### Bug 2: Video Görüşme - Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate video calls and verify that the remote video element does not have the `muted` attribute. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **VideoCallPage Remote Video Test**: Render VideoCallPage, verify remote video element does not have `muted` attribute (will fail on unfixed code)
2. **VideoCallOverlay Remote Video Test**: Render VideoCallOverlay, verify remote video element does not have `muted` attribute (will fail on unfixed code)
3. **Autoplay Test**: Simulate remote stream arrival, verify video does not autoplay without `muted` (will fail on unfixed code)
4. **Mobile Browser Test**: Test on mobile Safari/Chrome, verify autoplay is blocked without `muted` (will fail on unfixed code)
5. **Local Video Comparison**: Verify local video has `muted` attribute (should pass on unfixed code)

**Expected Counterexamples**:
- Remote video element does not have `muted` attribute in JSX
- Browser console shows autoplay blocked errors
- Remote video stream is assigned to `srcObject` but video does not play
- Possible causes: missing `muted` attribute, browser autoplay policy, mobile restrictions

### Bug 2: Video Görüşme - Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (remote video stream received), the fixed function renders the remote video element with the `muted` attribute.

**Pseudocode:**
```
FOR ALL videoCall WHERE remoteStreamReceived(videoCall) DO
  remoteVideoElement := getRemoteVideoElement_fixed(videoCall)
  ASSERT remoteVideoElement.hasAttribute('muted')
  ASSERT remoteVideoElement.muted == true
  ASSERT remoteVideoElement.autoPlay == true
  ASSERT remoteVideoElement.playsInline == true
END FOR
```


### Bug 2: Video Görüşme - Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (local video, audio tracks, connection setup), or for all WebRTC behavior, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL videoCall WHERE localVideoRendered(videoCall) DO
  ASSERT getLocalVideoElement_original(videoCall).muted == getLocalVideoElement_fixed(videoCall).muted
  // Local video should already be muted, no change
END FOR

FOR ALL videoCall WHERE peerConnectionSetup(videoCall) DO
  ASSERT setupPeerConnection_original(videoCall) == setupPeerConnection_fixed(videoCall)
  // Connection setup should be identical
END FOR

FOR ALL videoCall WHERE audioTrackToggled(videoCall) DO
  ASSERT toggleMic_original(videoCall) == toggleMic_fixed(videoCall)
  // Audio track toggle should be identical
END FOR

FOR ALL videoCall WHERE videoTrackToggled(videoCall) DO
  ASSERT toggleCam_original(videoCall) == toggleCam_fixed(videoCall)
  // Video track toggle should be identical
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for local video, audio/video toggles, and connection setup, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Local Video Preservation**: Verify local video still has `muted` attribute and works the same way
2. **Mic Toggle Preservation**: Toggle microphone on/off, verify audio tracks are enabled/disabled the same way
3. **Camera Toggle Preservation**: Toggle camera on/off, verify video tracks are enabled/disabled the same way
4. **Connection Setup Preservation**: Start video call, verify peer connection setup is identical
5. **ICE Candidate Preservation**: Verify ICE candidate exchange works the same way
6. **Signaling Preservation**: Verify offer/answer signaling works the same way
7. **End Call Preservation**: End video call, verify cleanup works the same way


### Unit Tests

#### Bug 1: Mesaj Çevirisi
- Test that `translationProvider` field is saved to database for local dictionary translations
- Test that `translationProvider` field is saved to database for MyMemory API translations
- Test that `translationProvider` field is saved to database for LibreTranslate API translations
- Test that `translationProvider` field is saved to database for fallback cases
- Test that image messages do not have `translationProvider` field (or have 'local')
- Test that same-language messages have `translationProvider: 'local'`
- Test that message history loaded from database includes `translationProvider` field
- Test that Socket.IO `receive_message` event includes `provider` field

#### Bug 2: Video Görüşme
- Test that remote video element in VideoCallPage has `muted` attribute
- Test that remote video element in VideoCallOverlay has `muted` attribute
- Test that local video element still has `muted` attribute (unchanged)
- Test that remote video autoplay works with `muted` attribute
- Test that audio tracks are not affected by remote video `muted` attribute
- Test that mic toggle still works correctly
- Test that camera toggle still works correctly

### Property-Based Tests

#### Bug 1: Mesaj Çevirisi
- Generate random text messages with different languages (tr, th)
- Verify that all messages have `translationProvider` field in database
- Verify that `translationProvider` value is one of ['local', 'mymemory', 'libretranslate', 'fallback']
- Generate random image messages, verify they are not translated
- Generate random same-language messages, verify `translationProvider: 'local'`
- Verify that translation results (originalText, translatedText, etc.) are unchanged

#### Bug 2: Video Görüşme
- Generate random video call scenarios (caller/answerer, mini/full mode)
- Verify that remote video element always has `muted` attribute
- Verify that local video element always has `muted` attribute
- Generate random mic/camera toggle sequences, verify behavior is unchanged
- Generate random connection state changes, verify behavior is unchanged

### Integration Tests

#### Bug 1: Mesaj Çevirisi
- Test full message flow: send message → translate → save to database → load from database → verify provider field
- Test message history: send multiple messages with different providers → reload page → verify all providers are preserved
- Test Socket.IO flow: send message → receive via Socket.IO → verify provider field is present
- Test fallback chain: send message that triggers local → mymemory → libretranslate → fallback, verify provider is correct at each step

#### Bug 2: Video Görüşme
- Test full video call flow: start call → receive remote stream → verify video plays automatically
- Test mobile browser: simulate mobile Safari/Chrome, verify autoplay works with `muted`
- Test Android APK: test in WebView, verify autoplay works with `muted`
- Test mini/full mode: toggle between modes, verify remote video still has `muted` attribute
- Test mic/camera toggle during call: toggle mic/camera, verify remote video continues playing
