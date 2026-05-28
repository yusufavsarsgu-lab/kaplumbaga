# Implementation Plan

## Bug 1: Mesaj Çevirisi - Translation Provider Persistence

### Exploration Phase

- [-] 1. Write bug condition exploration test for translation provider persistence
  - **Property 1: Bug Condition** - Translation Provider Not Saved to Database
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the `translationProvider` field is missing from the database
  - **Scoped PBT Approach**: Test concrete cases for each provider type (local, mymemory, libretranslate, fallback)
  - Test implementation details:
    - Send a text message that triggers local dictionary translation (e.g., "Seni seviyorum")
    - Verify TranslationService returns `provider: 'local'` in TranslationOutcome
    - Query database for the saved message
    - Assert that `translationProvider` field exists and equals 'local'
    - Repeat for MyMemory API (e.g., "Bugün hava güzel")
    - Repeat for LibreTranslate API (message that bypasses local and MyMemory)
    - Repeat for fallback case (message that fails all providers)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS because `translationProvider` field does not exist in database schema
  - Document counterexamples found:
    - Database query shows `translationProvider` field is undefined/null
    - Prisma schema does not include `translationProvider` field
    - Messages sent via Socket.IO have temporary `provider` field but database records don't
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

### Preservation Phase

- [ ] 2. Write preservation property tests for translation service behavior (BEFORE implementing fix)
  - **Property 2: Preservation** - Translation Service Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Send image message (type: 'image'), observe it's not translated
    - Send same-language message (tr-tr or th-th), observe no translation occurs
    - Send text message, observe fallback chain (local → mymemory → libretranslate → fallback)
    - Observe `originalText`, `translatedText`, `sourceLang`, `targetLang`, `translationStatus` values
    - Observe Socket.IO event payloads for `send_message` and `receive_message`
    - Observe `deliveryStatus` (sent/delivered/read) behavior
  - Write property-based tests capturing observed behavior patterns:
    - **Property**: For all image messages, translation is not performed and type remains 'image'
    - **Property**: For all same-language messages (sourceLang == targetLang), provider is 'local' and no API call is made
    - **Property**: For all text messages, translation result fields (originalText, translatedText, etc.) are identical before and after fix
    - **Property**: For all messages, deliveryStatus behavior is unchanged
    - **Property**: For all Socket.IO events, payload structure is unchanged (only addition is translationProvider field)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

### Implementation Phase

- [ ] 3. Fix for translation provider persistence

  - [~] 3.1 Add translationProvider field to Prisma schema
    - Open `backend/prisma/schema.prisma`
    - Locate the `Message` model
    - Add `translationProvider String?` field after `translationStatus`
    - Field should be nullable (String?) to support existing messages
    - Valid values: 'local' | 'mymemory' | 'libretranslate' | 'fallback'
    - Run `npx prisma migrate dev --name add_translation_provider` to create migration
    - Run `npx prisma generate` to update Prisma client
    - _Bug_Condition: isBugCondition(input) where input.message.type == 'text' AND input.translationOutcome.provider IN ['local', 'mymemory', 'libretranslate', 'fallback'] AND NOT database.hasField('Message.translationProvider')_
    - _Expected_Behavior: translationProvider field exists in database and contains provider value from TranslationOutcome_
    - _Preservation: Existing Message fields (originalText, translatedText, sourceLang, targetLang, translationStatus) remain unchanged_
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [~] 3.2 Save translationProvider to database in send_message handler
    - Open `backend/src/index.ts`
    - Locate the `socket.on('send_message')` handler
    - Find the `prisma.message.create()` call
    - Add `translationProvider: translation.provider` to the data object
    - Placement: after `translationStatus` field
    - Ensure the value comes from `translation.provider` (TranslationOutcome)
    - _Bug_Condition: translation.provider value exists but is not saved to database_
    - _Expected_Behavior: translationProvider field is saved with value from TranslationOutcome_
    - _Preservation: Existing message creation logic unchanged, only adding new field_
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [~] 3.3 Include translationProvider in ChatMessage conversion
    - Open `backend/src/index.ts` (or locate `toChatMessage()` function)
    - If `toChatMessage()` function exists, add `provider: message.translationProvider` to returned object
    - If function doesn't exist, ensure message history loading includes `translationProvider` field
    - Verify Socket.IO `receive_message` event includes `provider` field
    - Note: Current code manually assigns `chatMessage.provider = translation.provider` after `toChatMessage()` - this should continue working but now also read from database
    - _Bug_Condition: Database has translationProvider but it's not included in ChatMessage sent to frontend_
    - _Expected_Behavior: ChatMessage includes provider field from database_
    - _Preservation: Existing ChatMessage structure unchanged, only adding provider field_
    - _Requirements: 1.2, 1.4, 2.2, 2.3, 2.4_

  - [~] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Translation Provider Saved to Database
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify for all provider types:
      - Local dictionary: `translationProvider: 'local'` in database
      - MyMemory API: `translationProvider: 'mymemory'` in database
      - LibreTranslate API: `translationProvider: 'libretranslate'` in database
      - Fallback: `translationProvider: 'fallback'` in database
    - Verify message history includes provider field
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [~] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Translation Service Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify all preservation properties:
      - Image messages still not translated
      - Same-language messages still use 'local' provider without API calls
      - Translation result fields (originalText, translatedText, etc.) unchanged
      - Fallback chain (local → mymemory → libretranslate → fallback) unchanged
      - DeliveryStatus behavior unchanged
      - Socket.IO event structure unchanged (only addition is translationProvider)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [~] 4. Checkpoint - Ensure all translation provider tests pass
  - Run all tests for Bug 1 (exploration + preservation)
  - Verify database migration applied successfully
  - Verify existing messages have null translationProvider (acceptable)
  - Verify new messages have translationProvider field populated
  - Test message flow end-to-end: send → translate → save → load → verify provider
  - Ask the user if questions arise

---

## Bug 2: Video Görüşme - Remote Video Autoplay

### Exploration Phase

- [~] 5. Write bug condition exploration test for remote video autoplay
  - **Property 1: Bug Condition** - Remote Video Missing Muted Attribute
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate remote video element lacks `muted` attribute
  - **Scoped PBT Approach**: Test concrete scenarios in both VideoCallPage and VideoCallOverlay
  - Test implementation details:
    - Render VideoCallPage component
    - Locate remote video element (remoteVideoRef)
    - Assert that video element has `muted` attribute
    - Assert that video element has `autoPlay` attribute (should exist)
    - Assert that video element has `playsInline` attribute (should exist)
    - Repeat for VideoCallOverlay component
    - Simulate remote stream arrival via `ontrack` event
    - Verify video element can autoplay with `muted` attribute
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS because remote video element does not have `muted` attribute
  - Document counterexamples found:
    - VideoCallPage remote video: `<video autoPlay playsInline />` (missing `muted`)
    - VideoCallOverlay remote video: `<video autoPlay playsInline />` (missing `muted`)
    - Browser console shows autoplay blocked errors
    - Remote video stream assigned to srcObject but video doesn't play
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

### Preservation Phase

- [~] 6. Write preservation property tests for WebRTC behavior (BEFORE implementing fix)
  - **Property 2: Preservation** - WebRTC Connection Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Render VideoCallPage, observe local video has `muted` attribute
    - Start video call, observe peer connection setup process
    - Observe ICE candidate exchange and signaling
    - Toggle microphone, observe audio track `enabled` property changes
    - Toggle camera, observe video track `enabled` property changes
    - End call, observe cleanup (peer connection closed, streams stopped)
    - Observe `onconnectionstatechange` handler behavior
    - Test in VideoCallOverlay mini/full mode, observe mode toggle behavior
  - Write property-based tests capturing observed behavior patterns:
    - **Property**: For all video calls, local video element has `muted` attribute (unchanged)
    - **Property**: For all peer connections, setup process (ICE, signaling) is identical
    - **Property**: For all mic toggles, audio track `enabled` property is toggled (unchanged)
    - **Property**: For all camera toggles, video track `enabled` property is toggled (unchanged)
    - **Property**: For all call endings, cleanup process is identical
    - **Property**: For all connection state changes, handler behavior is identical
    - **Property**: For all STUN/TURN configurations, server list is unchanged
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_

### Implementation Phase

- [ ] 7. Fix for remote video autoplay

  - [~] 7.1 Add muted attribute to remote video in VideoCallPage
    - Open `frontend/src/pages/VideoCallPage.tsx`
    - Locate the remote video element (around line 243-248)
    - Current code: `<video ref={remoteVideoRef} autoPlay playsInline className="..." />`
    - Change to: `<video ref={remoteVideoRef} autoPlay playsInline muted className="..." />`
    - Reason: Browser autoplay policy requires `muted` attribute for autoplay to work
    - Note: This does NOT affect audio output - WebRTC audio comes through peer connection, not video element
    - _Bug_Condition: isBugCondition(input) where input.videoElement.autoPlay == true AND input.videoElement.muted == false AND browserBlocksAutoplay(input.videoElement)_
    - _Expected_Behavior: Remote video element has muted attribute and autoplay works_
    - _Preservation: Local video, peer connection setup, audio/video toggles unchanged_
    - _Requirements: 2.1, 2.2, 2.6, 2.7, 2.8, 2.9_

  - [~] 7.2 Add muted attribute to remote video in VideoCallOverlay
    - Open `frontend/src/components/VideoCallOverlay.tsx`
    - Locate the remote video element (around line 338-342)
    - Current code: `<video ref={remoteVideoRef} autoPlay playsInline className="..." />`
    - Change to: `<video ref={remoteVideoRef} autoPlay playsInline muted className="..." />`
    - Reason: Same as VideoCallPage - browser autoplay policy
    - Note: This applies to both mini and full mode
    - _Bug_Condition: Same as 7.1 - remote video without muted attribute_
    - _Expected_Behavior: Remote video element has muted attribute and autoplay works in overlay_
    - _Preservation: Overlay mode toggle, local video, connection behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.6, 2.7, 2.8, 2.9_

  - [~] 7.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Remote Video Has Muted Attribute
    - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
    - The test from task 5 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 5
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify for both components:
      - VideoCallPage remote video has `muted` attribute
      - VideoCallOverlay remote video has `muted` attribute
      - Both have `autoPlay` and `playsInline` attributes (unchanged)
    - Verify autoplay works when remote stream arrives
    - Test on multiple browsers (Chrome, Safari, Firefox)
    - Test on mobile devices (iOS Safari, Android Chrome)
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10_

  - [~] 7.4 Verify preservation tests still pass
    - **Property 2: Preservation** - WebRTC Connection Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
    - Run preservation property tests from step 6
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify all preservation properties:
      - Local video still has `muted` attribute (unchanged)
      - Peer connection setup identical
      - ICE candidate exchange identical
      - Signaling process identical
      - Mic toggle behavior identical (audio track enabled/disabled)
      - Camera toggle behavior identical (video track enabled/disabled)
      - Call ending cleanup identical
      - Connection state change handler identical
      - STUN/TURN configuration identical
      - VideoCallOverlay mini/full mode toggle identical
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_

- [~] 8. Checkpoint - Ensure all video call tests pass
  - Run all tests for Bug 2 (exploration + preservation)
  - Test video call end-to-end: start call → receive remote stream → verify video plays
  - Test on desktop browsers (Chrome, Safari, Firefox)
  - Test on mobile browsers (iOS Safari, Android Chrome)
  - Test in Android APK WebView
  - Test both VideoCallPage and VideoCallOverlay
  - Test mini/full mode toggle in overlay
  - Verify audio is not affected by remote video `muted` attribute
  - Ask the user if questions arise

---

## Final Verification

- [~] 9. Integration testing for both bugs
  - Test complete message flow with translation provider persistence
  - Test complete video call flow with remote video autoplay
  - Verify no regressions in other features
  - Test on multiple platforms (desktop, mobile, APK)
  - Verify database migration applied correctly
  - Verify all property-based tests pass
  - Document any edge cases discovered during testing
