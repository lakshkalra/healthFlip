# healthFlip Implementation Tracker

This tracker is the source of truth for the controlled phase-by-phase build.
No phase advances until its acceptance criteria are verified and recorded here.

## Current status

| Phase | Status | Completion evidence |
| --- | --- | --- |
| Phase 0 - Environment and project foundation | COMPLETE | React Native scaffold, local API/PostgreSQL, Android emulator launch, and iOS simulator build/launch verified |
| Phase 1 - Backend foundation | COMPLETE | Separate API repository, centralized table schemas, reusable API modules, migrations, local integration tests, and Vercel preparation verified |
| Phase 2 - Mobile core flows | COMPLETE | v0 mobile flows, restart persistence, hosted API CRUD, and fresh Android hosted-API launch verified |
| Phase 3 - AI operations | IN PROGRESS | Fallback text/image API and mobile text/insight/voice/image integration implemented; live Gemini and physical-device media verification remain |
| Phase 4 - UX polish and edge cases | NOT STARTED | - |
| Phase 5 - Delivery and self-assessment | NOT STARTED | - |

## Phase 0 checklist

- [x] Initialize the React Native CLI app as `healthFlip`.
- [x] Install JavaScript dependencies.
- [x] Replace the starter screen with the branded `healthFlip` foundation screen.
- [x] Add the `healthflip-api` service boundary in its own repository.
- [x] Add local PostgreSQL Docker configuration to the API repository.
- [x] Initialize the local Git repository.
- [x] Install Android SDK platform/build tools 37.
- [x] Boot an Android emulator and launch the branded app.
- [x] Install the iOS runtime, boot an iPhone simulator, and launch the branded iOS build.
- [x] Start the backend locally and verify `GET /health`.
- [x] Start PostgreSQL locally and verify the backend database connection path.
- [x] Record the Phase 0 completion commit.

## Phase 0 files and systems changed

- React Native CLI scaffold in the `healthFlip` repository.
- `healthflip-api` sibling repository for the Fastify service and local PostgreSQL.

## Phase 0 verification log

- React Native CLI scaffold: passed.
- `npm install`: passed; 865 packages installed, 0 vulnerabilities reported.
- Backend dependency install: passed; 98 packages installed, 0 vulnerabilities reported.
- Backend typecheck: passed.
- Mobile lint: passed.
- Mobile Jest test with Watchman disabled: passed; 1 test suite, 1 test.
- Branded foundation screen lint/test: passed.
- Backend health endpoint: passed; `GET /health` returned HTTP 200 with service status `ok`.
- Backend database probe: passed; `GET /health/db` returned HTTP 200 after `SELECT 1` against local PostgreSQL.
- Android SDK platform 37 and Build Tools 37: installed automatically during the first debug build.
- Android emulator: `Medium_Phone_API_36.0` booted and connected as `emulator-5554`.
- Android debug build: passed; `:app:assembleDebug` completed successfully.
- Android launch: passed; `com.healthflip/.MainActivity` is foreground and displays the branded `healthFlip` foundation screen.
- Node.js: v24.5.0.
- Android SDK/ADB: available.
- Docker CLI: available.
- Docker daemon: passed; Docker Desktop is running and the `healthflip-postgres` container is healthy.
- Android environment: passed; API 36 emulator and project-required SDK platform 37 are available.
- iPhone launch: passed on the installed iOS 27.0 runtime using the iPhone 18 Pro simulator; the app reached its branded loading screen.

## iOS setup notes

The updated Xcode 27 installation is available and works when selected through
`DEVELOPER_DIR`. The system-wide developer directory remains Command Line Tools;
changing it requires macOS administrator authentication, which is optional because
the project commands can use the explicit Xcode path.

1. CocoaPods is installed through Homebrew and the workspace is generated at
   `ios/healthFlip.xcworkspace`.
2. The Podfile targets iOS 15.1, matching the React Native 0.87 dependencies and
   Xcode 27 simulator support.
3. The iOS app uses the UIKit scene lifecycle required by the Xcode 27 SDK.

Current iOS setup check on 2026-10-02:

- Xcode 27.0 (`27A266a`) is installed and opens successfully.
- `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -version` passed.
- The system-wide developer directory is still Command Line Tools; changing it requires
  macOS administrator authentication, which was not requested or entered.
- iOS 27.0 runtime is installed and the iPhone 18 Pro simulator is available and booted.
- CocoaPods installation passed and the healthFlip workspace exposes the `healthFlip` scheme.
- `xcodebuild ... -destination 'id=49147A48-D7C2-43AE-947D-CAAF514768B5' build` passed.
- The app installed and launched on the simulator; the captured screen showed the
  branded `Loading healthFlip...` screen.
- Full iOS API-flow verification is now passing against the local API after the mobile
  client was made platform-aware (`127.0.0.1` on iOS, `10.0.2.2` on Android).

## Phase 1 checklist

- [x] Add typed configuration, shared errors, validation, auth, and timezone helpers.
- [x] Add Drizzle schema and checked-in SQL migration for guests, guest sessions, goals, and meal entries.
- [x] Separate the API into its own `healthflip-api` repository.
- [x] Add reusable controller, service, router, helper, and validator modules for guests, goals, meals, and dashboard.
- [x] Centralize one Drizzle table schema per file under `src/db/schema/`, with data repositories under `src/db/repositories/`.
- [x] Add anonymous token authentication with only a token hash persisted to PostgreSQL.
- [x] Add guest-scoped goal, meal, and daily dashboard API routes.
- [x] Add local development and isolated integration-test database workflows.
- [x] Add API integration tests for authorization, validation, goal history, guest ownership, deletion, and daily aggregation.
- [x] Document the backend architecture, migrations, test workflow, and Vercel project-root configuration.
- [x] Verify mobile lint/tests, backend typecheck, migration validation, integration tests, and production dependency audit.
- [x] Record the Phase 1 completion commit.

## Phase 1 verification log

- Drizzle migration generation: passed; initial schema and database-constraint migrations generated and checked.
- Development and test database migration: passed.
- Backend integration suite: passed; 4 tests covering unauthorized access, invalid input, goal replacement/ownership, and daily totals after deletion.
- Backend typecheck: passed.
- Mobile lint and Jest suite: passed.
- Production dependency audit: passed; zero known vulnerabilities.
- Architecture correction: passed; `healthFlip` and `healthflip-api` are independent Git repositories, and the API has the agreed module/database boundaries.
- Vercel preparation: complete; deploy the `healthflip-api` repository as the project root and provide `DATABASE_URL` after user authorization. No Vercel or managed-database credentials requested yet.

## Phase 2 design checkpoint

### Phase 2 closure objective

Finish and verify the non-AI user journey before beginning Phase 3. This phase
has no account sign-up or login. The existing anonymous device session remains
an internal data-scoping mechanism only.

### Phase 2 closure checklist

- [x] Allow a user to save a custom meal name without selecting the local food list.
- [x] Persist the selected meal category in PostgreSQL and return it through the API.
- [x] Add a dashboard path to edit an existing daily goal.
- [x] Add or update automated coverage for the changed API/mobile contracts.
- [x] Apply the new local database migration and verify the full manual flow.
- [x] Verify goal and meals survive a complete app restart.
- [x] Verify the same flow against the deployed Vercel API and Neon database.

- [x] Finalize the first-run goal setup flow.
- [x] Finalize the daily dashboard flow.
- [x] Finalize the manual add-meal flow.
- [x] Finalize meal detail, edit, and delete behavior.
- [x] Create a visual prototype for UI review before mobile implementation.
- [x] Establish implementation constraints: reusable components, minimal code, and no scope beyond the Phase 2 requirements.
- [x] Review the prototype and approve the v0 functional direction.
- [x] Define the mobile component and navigation structure.
- [x] Implement the v0 flows with reusable primitives and a small API client.
- [x] Document the complete Phase 2 page-by-page functional flow.
- [x] Run lint, Jest, TypeScript, Android build, and local emulator verification.
- [x] Implement and verify the Claude design handoff on the iOS simulator.
- [x] Verify data survives a complete app restart.
- [x] Verify the mobile app against the deployed API endpoint.
- [x] Add the bottom navigation flows for Progress, Tips, and Rewards.
- [x] Add Progress range selection, empty/loading/error states, trend/day-detail structure,
  and navigation back to the dashboard.
- [x] Add curated Tips categories and a practical tip-detail flow with wellness-only copy.
- [x] Keep Rewards intentionally scoped to a polished coming-soon screen.
- [x] Preserve goal editing while integrating the new navigation flows.

## Phase 2 implementation evidence

- AsyncStorage added for the anonymous guest token and restart persistence.
- Reusable mobile primitives added for cards, buttons, fields, choices, meal rows,
  loading, empty, and error states.
- v0 flows implemented: goal setup, daily dashboard, add meal, meal detail, edit, and
  delete confirmation.
- API client uses the existing guest, goal, dashboard, and meal endpoints; AI and
  media flows remain out of scope.
- Mobile lint: passed.
- Mobile Jest suite: passed; AsyncStorage test double added.
- Mobile TypeScript check: passed.
- Android debug build: passed with AsyncStorage native integration.
- Android emulator manual check: passed; goal saved, dashboard loaded from local API,
  meal saved to PostgreSQL, dashboard updated to 380 / 2000 kcal, and meal detail opened.
- Claude design handoff: implemented reusable visual primitives, vector icons/progress
  ring via `react-native-svg`, goal setup, dashboard, meal entry, detail, edit, delete,
  loading, retry, and error states.
- Root lint: passed after excluding the generated `design/` handoff export from the
  application lint scope; the handoff remains untracked and is not part of the app build.
- iOS build: passed with CocoaPods and `xcodebuild` on the iPhone 18 Pro simulator.
- iOS runtime verification: passed; the app progressed from boot to the redesigned goal
  setup screen, and the guest bootstrap request returned HTTP 200 from the local API.
- iOS runtime fix: the API client now selects the correct local host per platform. The
  previous iOS failure was caused by the Android-only `10.0.2.2` address.
- Phase 2 closure migration: `meal_type` is now a PostgreSQL enum on `meal_entries`.
  The API validates and returns it, and the mobile app no longer stores meal category
  as device-only metadata.
- Phase 2 closure checks: mobile lint, TypeScript, and Jest passed; API typecheck,
  migration check, and the 4-test isolated PostgreSQL integration suite passed.
- Android manual closure verification: saved the custom meal `Homemade pasta` without
  choosing a suggestion, under Lunch at 510 kcal; the dashboard updated to 510 / 2000
  kcal, and the same goal, meal, total, and category were present after force-closing
  and reopening the app.
- Hosted API verification: `https://healthflip-api.vercel.app/health` and `/health/db`
  returned HTTP 200; the hosted guest, goal, meal, dashboard, and meal-delete flow
  passed against Neon. The dashboard returned 510 total calories, 1 meal, and the
  persisted `lunch` category before the exact temporary meal was deleted.
- Hosted mobile verification: the mobile API client now targets the deployed Vercel
  service; a fresh Android emulator install launched cleanly, bootstrapped an anonymous
  guest, saved the 2,000 kcal goal, and rendered the dashboard from the hosted API.
- Android debug build: passed with the emulator active architecture optimization;
  the universal APK install was skipped because the AVD internal volume was nearly full.
- Navigation design implementation verification (2026-10-02): Android emulator reached
  the dashboard after a fresh guest bootstrap against the local API; Progress empty state,
  Tips list/detail, Rewards coming-soon, and the restored goal-edit flow were manually
  exercised. No fatal React Native runtime error was observed.
- Navigation test coverage: mobile lint, TypeScript, and Jest passed; Jest reports 1 suite
  and 6 tests passing. Android debug build/install completed successfully.

The authoritative functional flow is documented in
`docs/phase-2-flow-spec.md`. The Claude design handoff is sufficient for v0 flow
validation; the larger Phase 4 polish pass remains required.

Production v0 mobile screens are now implemented. AI estimation, photo analysis, voice
input, chat, and wellness insights remain Phase 3 scope.

## Phase 3.0 AI contract checkpoint

- [x] Define provider-independent text meal-estimation contract.
- [x] Define Kimbo daily-insight contract using persisted goal and meal data.
- [x] Define the backend `ai` module and shared provider adapter boundaries.
- [x] Define deterministic fallback behavior and structured AI failure codes.
- [x] Define wellness-only safety language, validation, timeout, quota, and logging rules.
- [x] Confirm the first AI slice requires no database migration.
- [x] Implement the fallback backend slice in `healthflip-api`.

### Phase 3.1 fallback backend evidence

- Added the reusable `ai` controller/service/router/helper/validator module.
- Added provider-independent contracts with a deterministic fallback provider.
- Added `POST /v1/ai/meal-estimate` and `GET /v1/ai/daily-insight`.
- Fallback insights read the persisted guest goal and daily meals through existing
  repositories; no new table or duplicate SQL was introduced.
- Backend typecheck: passed.
- Backend test suite: passed; 7 tests covering existing API behavior, fallback
  estimation, persisted-context insights, validation, and provider timeout mapping.
- Gemini remains pending; voice input, image input, and the first mobile AI UI slice are now implemented.

### Phase 3 mobile integration evidence (2026-10-02)

- Added typed mobile client methods for `POST /v1/ai/meal-estimate` and
  `GET /v1/ai/daily-insight`.
- Added the `Estimate with AI` meal-entry flow. The returned name, calories, and
  macros populate editable fields; fallback assumptions are shown for review.
- Added Kimbo's daily wellness nudge to the dashboard with loading and retry/error
  states. It refreshes after goal and meal changes.
- Host-level API smoke test: guest bootstrap, fallback meal estimate, and persisted
  daily insight all returned the expected structured responses.
- Mobile lint: passed.
- Mobile TypeScript check: passed.
- Mobile Jest suite: passed; 1 suite and 6 tests.
- Android debug build/install: passed on `emulator-5554`; `com.healthflip` launched.
- Android Studio reports an AGP 9.2.1 compatibility warning during IDE sync; the
  command-line React Native build and installation are successful.
- Voice input: added a native speech-recognition adapter with runtime microphone
  permission handling, partial/final transcript updates, and an unavailable-device
  fallback that preserves manual entry.
- Image input: added camera/library selection, resize/quality limits, supported MIME
  validation, preview, and a reviewable fallback estimate through the new image API route.
- Native dependency audit: passed with 0 vulnerabilities after replacing the deprecated
  voice package with `react-native-speech-recognition-kit`.
- iOS pods: passed; image picker and speech recognition autolinked.
- iOS simulator build: passed with the new native modules and permission strings.
- Android debug build/install: passed with the new native modules and `RECORD_AUDIO`
  manifest permission.
- Image API smoke test: passed; `POST /v1/ai/meal-estimate-image` returned HTTP 200 with
  a structured fallback estimate.
- AI interaction structure revision: moved text, voice, and image estimation out of the Log
  meal sheet into a reusable floating `Ask Kimbo` assistant. The Log meal sheet is now reserved
  for curated pre-selected foods and manual review/save. The assistant can log an accepted estimate
  directly with its source metadata and refresh the dashboard.

### Physical iPhone setup checkpoint (2026-10-02)

- Connected iPhone 15 Pro detected; a valid Apple Development signing identity is available.
- CocoaPods refresh and workspace/scheme inspection passed using
  `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` without changing the
  system-wide developer directory.
- Fixed Xcode's `ENABLE_USER_SCRIPT_SANDBOXING` setting for Debug and Release.
  The previous device build could not write React Native's `ip.txt` file.
- Fixed the development API host: iOS follows Metro's Mac hostname, while Android
  retains `10.0.2.2`. Added a local-network permission explanation.
- Restarted the local API with `HOST=0.0.0.0 npm start`; API health and Metro status
  passed through the Mac's Wi-Fi address. Keep both servers running and the phone
  on the same network for development testing.
- `npm run lint`, `npx tsc --noEmit`, and
  `npm test -- --runInBand --watchman=false` passed (6 tests). Watchman was disabled
  only for the test command because the execution sandbox denied its socket.
- Native compilation and JavaScript bundling progressed past the original error.
  Device signing failed on `React.framework` with `errSecInternalComponent`; Mac
  keychain authorization is the remaining gate. A signed rebuild is being retried.
- Signed physical-device build passed and the app installed on the connected iPhone 15 Pro.
- iOS trust approval, signed installation, and launch on the physical iPhone 15 Pro passed.
- The physical device reached the local API over Wi-Fi (`192.168.0.3` → `192.168.0.5:3000`)
  and received successful goal/dashboard responses after the development-host fallback fix.
- Recovered the local PostgreSQL dependency after Docker Desktop was restarted; the API
  database health probe, guest bootstrap, dashboard, and image-estimate smoke checks returned
  successfully, and the installed iPhone build loaded the dashboard again.
- iPhone Mirroring is not a valid camera/microphone test surface: Apple does not pass those
  inputs through mirroring, so its `Recognition request was canceled` result is expected there.
  Direct interaction on the physical iPhone remains required for camera and speech verification.
- Earlier after the Xcode update, a fresh physical-device rebuild was blocked because the
  local `iOS Development` signing certificate/private key was unavailable to Xcode; this was
  resolved by restoring the Apple account in Xcode.
- Latest assistant-flow build: Apple account signing was restored, the signed app was installed
  and relaunched on the iPhone 15 Pro, and device logs showed successful goal, dashboard, and
  Kimbo insight API responses. Mirroring disconnected because the phone was actively in use.
- Fixed the Kimbo bottom-sheet render crash observed on the iPhone: the native speech adapter's
  `destroy()` can return synchronously, so cleanup now safely handles both sync and Promise results.
  The voice listener lifecycle now remains stable while partial transcripts update, and cleanup
  safely handles both sync and Promise results. Rebuilt, reinstalled, and relaunched the signed
  physical-device app; lint, TypeScript, and all 6 Jest tests pass.
- Re-ran `pod install` after the Xcode update so `ios/healthFlip.xcworkspace` includes the full
  native dependency graph. The workspace lists the `healthFlip` scheme and the generic signed
  iOS build now passes successfully.
- Replaced the Kimbo bottom sheet with a dedicated full-screen assistant route. The composer is
  keyboard-aware, the message list auto-scrolls, media actions are disabled while busy, and API
  failures are shown in the conversation instead of being swallowed.
- Added AI guardrails for prompt-injection/medical requests, image-size limits, invalid provider
  output, and persisted daily-insight output. The isolated backend integration suite now passes
  9/9, including safety rejection cases.
- Added the backend-only Gemini provider adapter for structured text estimates, image estimates,
  and daily insights. The provider is selected only when `GEMINI_API_KEY` exists; otherwise the
  deterministic fallback remains active. The current local environment has no Gemini key, so live
  provider verification is still pending.
- Added explicit `AI_PROVIDER=auto|fallback|gemini` selection and `GET /health/ai`, which reports
  the active provider without exposing secrets. Decimal macro values from Gemini are now accepted
  by the output validator. Backend integration suite passes 10/10.
- Live Gemini verification (2026-10-03): PostgreSQL, API health, and `/health/ai` passed with
  `{ provider: "gemini", live: true }`. A real text request returned `source: "ai"`, a specific
  meal name, 540 kcal, medium confidence, and portion assumptions. A synthetic image request
  returned `source: "ai"` and correctly reported an unrecognized blank image instead of the old
  350 kcal fallback. A persisted-goal daily insight returned `source: "ai"`. Guardrail smoke tests
  returned 422 `AI_SAFETY_BLOCKED` and 413 `AI_IMAGE_TOO_LARGE`.
- Updated the Gemini model from `gemini-2.5-flash` after Google rejected it for new users; the
  current configured model is `gemini-3.8-flash`.
- iPhone reload is pending one manual unlock: CoreDevice sees the paired iPhone 15 Pro, but iOS
  denied launch while the device was locked.
- Photo fallback behavior is now explicit in the mobile estimate card: assumptions are shown,
  and the local provider states that it cannot identify ingredients until the live vision provider
  is configured.
- Current device check: the signed generic iOS build passes, but CoreDevice currently reports the
  iPhone as unavailable because iPhone Mirroring says “iPhone in Use.” The rebuilt app could not
  be reinstalled in this pass until the phone is locked and reconnects. Direct physical voice and
  camera verification therefore remains an explicit pending item.
- Device update completed after the iPhone reconnected: the signed `healthFlip.app` installed
  successfully on iPhone 15 Pro (`00008130-000E1D8201D8001C`) and relaunched successfully with
  bundle ID `org.reactjs.native.example.healthFlip`.
- Camera/speech verification remain pending. This checkpoint does not mark Phase 3 complete.

### Phase 3 live voice protocol evidence (2026-10-03)

Backend (`healthflip-api`):

- Restarted the API after the `liveConnectConstraints` → `bidiGenerateContentSetup` patch. The
  first live-session call after the restart still returned 503. A sanitized direct probe showed the
  token endpoint now accepts the payload, but returns only `name` (no `expireTime`). The provider
  required `expireTime` and treated the success as a failure. Fixed
  `src/shared/ai/live-session-provider.ts` to use the expiry it requested (15 minutes).
- Smoke test (token never printed): `/health/db` 200, `/health/ai` `{ provider: "gemini", live: true }`,
  guest 200, `POST /v1/ai/live-session` 200 in ~560 ms with `hasToken: true`,
  `model: gemini-3.8-live`, `expiresAt` set, `BidiGenerateContentConstrained` URL.
- Added `tests/live-session-provider.test.ts` (payload field, name-only response, rejected request).
  `npm run typecheck` passed; integration 12/12 and provider 2/2 passed.

Gemini Live protocol, verified from Node against the real constrained WebSocket using backend-issued
tokens:

- The setup the app previously sent (`responseModalities` at the top level of `setup`) is rejected with
  close `1007 Unknown name "responseModalities" at 'setup'`. A setup with only `{ model }` works,
  because the token locks the config, voice, transcription and system instruction.
- Every server message arrives as a **binary** frame containing UTF-8 JSON, including `setupComplete`.
  The previous string-only handler would have dropped them all.
- Synthesized speech (macOS `say`, 16 kHz PCM16, 100 ms chunks, then silence) produced an exact input
  transcript, a 24 kHz PCM audio reply, and an output transcript that follows the Kimbo system
  instruction. Setup took ~1.4 s; the first reply audio arrived ~1.2 s after speech ended
  (VAD silence included). The input transcript arrives before `turnComplete`.

Mobile (`src/voice.tsx`, new `src/voiceProtocol.ts`):

- `onopen` sends only the minimal setup. The native audio session, the 24 kHz player and the 16 kHz
  recorder start only after `setupComplete`; mic chunks are not sent before that.
- `binaryType = 'arraybuffer'` plus a UTF-8 decode (`TextDecoder` with a Devanagari-safe fallback).
- A close or error before setup now shows an error state with the close reason, instead of staying on
  "Connecting" forever. An attempt counter discards stale async work after End, Back or unmount.
- Input and output transcription fragments are accumulated per turn. The meal estimate uses the full
  user utterance. Review-card messages always append a new bubble rather than overwriting
  Kimbo's speech.
- State updates are guarded (no re-render per audio chunk). The mic level drives a Reanimated shared
  value directly, removing the 20-per-second whole-screen re-renders. `goAway` shows a time-limit
  message and ends the session cleanly (no auto-reconnect, because tokens are single-use).
- Fixed the Jest Reanimated mock so `useSharedValue` is stable across renders, as it is in the real
  library.
- Added `__tests__/voice.test.tsx` (8 tests):
  - setup sent first, and audio held until `setupComplete`;
  - string, ArrayBuffer and typed-array parsing, and malformed JSON ignored;
  - UTF-8 fallback;
  - fragment accumulation, and logging only after **Confirm and log**;
  - End with a pending estimate does not log;
  - close before setup gives an error state;
  - mic denial is recoverable.
- `npx tsc --noEmit`, `npm run lint` and `npm test -- --runInBand --watchman=false` passed: 2 suites,
  14 tests.

Physical iPhone (iPhone 15 Pro, `00008130-000E1D8201D8001C`):

- The installed build predated the Reanimated, Worklets and Nitro native packages. Opening Talk live
  therefore failed with "cannot read properties of undefined (VoiceConversationScreen)", because a
  Metro reload cannot add native code.
- Rebuilt with `xcodebuild` (Debug, signed, `-allowProvisioningUpdates`) and reinstalled with
  `xcrun devicectl device install app`. The new binary contains the NitroModules, RealtimeAudio,
  Reanimated and Worklets symbols.
- Result: a live voice conversation with Kimbo works on the device. This is accepted as **v0**: voice
  quality and conversational realism need a dedicated improvement pass.
- The local API must listen on all interfaces for the phone to reach it. `.env` now uses
  `HOST=0.0.0.0` (local only, not committed).
- Image meal estimation is still **not working** on the device (HEIC and the photo path, handoff
  item D).

### Personalisation: profile, AI plan, live steps, Flip memory (2026-10-03)

- Guest-based; no login. New tables `guest_profiles` (adults 18–100, height, weight, sex, activity) and
  `guest_memories`, plus nullable plan columns on `goals` (migration `0004_profile_plan_memory`).
- Plan: a deterministic Mifflin-St Jeor baseline (`src/shared/nutrition.ts`) that Gemini personalises.
  The guard keeps calories within 10% of the baseline and above the floor (max(BMR, 1200)), requires
  macros to add up, and keeps steps between 3k and 20k. On AI failure, the baseline plan is returned
  so onboarding never blocks.
  - Real Gemini through the backend: Arjun (maintain) 2,650 kcal and 10k steps; Priya (lose)
    1,400 kcal, exactly at the floor. About 1.5–1.8 s each.
- Memory: the `save_memory` live tool, plus `GET/POST/DELETE /v1/memories` with dedupe, a cap of 50,
  and an injection/medical screen. Memories go into Flip's prompt as data. Real Gemini: one sentence
  produced two calls, "Vegetarian" (diet) and "Goes to the gym every morning at 7am" (routine).
- Mobile:
  - three-step onboarding (`src/onboarding.tsx`);
  - a Home plan card with live Apple Health steps (`@kingstinct/react-native-healthkit` 16);
  - a Profile screen with "What Flip remembers";
  - Flip greets the user by name.
  - A manual calorie edit keeps the plan's steps and rescales its macros.
- iOS: HealthKit entitlement and usage strings. The Podfile `post_install` adds core's private module
  path to `ReactNativeHealthkit` (needed for explicit module builds). The signed Debug build with the
  HealthKit entitlement installed on the iPhone 15 Pro.
- Checks:
  - API: typecheck, unit 15/15, integration 17/17.
  - Mobile: tsc, lint, Jest 25/25.
- Pending:
  - device run of onboarding, the Health permission and steps, and memory in a live conversation;
  - Android step tracking (Health Connect);
  - production migration 0004.

### Diet and exercise plans with PDF (2026-10-03)

- API:
  - `POST /v1/plans/generate` returns an unsaved draft.
  - `POST /v1/plans` saves it, re-validating the content.
  - `GET /v1/plans`, `GET /v1/plans/:id` and `DELETE /v1/plans/:id` list, read and delete plans.
  - `GET /v1/plans/:id/pdf` returns an A4 PDF from pdfkit.
  - Plans are stored in the `wellness_plans` table (migration `0005_wellness_plans`).
- Generation uses the profile, the goal targets and Flip's memories:
  - diet: 1, 3 or 7 days, diet type and cuisine;
  - exercise: 2–6 days a week, home/gym/outdoors, level and minutes per session;
  - notes are screened for injection and medical requests.
  - If the AI fails or returns invalid output, a template plan is used and labelled. Templates drop
    foods the user's memories say they are allergic to or avoid.
- Real Gemini through the backend:
  - a 7-day vegetarian diet in about 7 s, each day within 10 kcal of 1,600 and peanut-free for a
    user with a peanut-allergy memory;
  - a 4-day home workout in about 4 s.
  - The PDFs were checked visually; each day's block now stays on one page.
- Voice: the `create_plan` tool. Real Gemini mapped "make me a three-day vegetarian meal plan" to
  `{kind: diet, days: 3, dietType: vegetarian}` and pointed the user to the Plans tab.
- Mobile:
  - the Plans tab replaces Rewards;
  - generate forms, preview, Save, a saved list, and Download PDF, which uses
    `react-native-blob-util` and opens iOS Quick Look with Share / Save to Files / Print;
  - Flip's notes in the transcript.
- Checks:
  - API: typecheck, unit 20/20, integration 19/19.
  - Mobile: tsc, lint, Jest 27/27.
  - The signed build is installed on the iPhone 15 Pro.
- Pending:
  - on-device check of the PDF viewer;
  - production migrations 0004–0005.

### Phase 3 remaining checklist

- [ ] Add and verify the live Gemini provider adapter (requires Gemini API key).
- [x] Connect text meal estimation to the mobile meal-entry flow using the fallback provider.
- [x] Connect Kimbo's persisted daily insight to the mobile dashboard.
- [x] Add voice input with deterministic unavailable-provider behavior.
- [x] Add image input with deterministic unavailable-provider behavior.
- [ ] Add AI-specific mobile interaction tests for estimate success and failure.
- [ ] Add and verify the live Gemini image provider adapter (requires Gemini API key).
- [x] Live voice: ephemeral token provisioning verified against Gemini (2026-10-03).
- [x] Live voice: mobile setup ordering, binary frames and transcript handling fixed, with tests.
- [x] Live voice: physical iPhone conversation working (v0, 2026-10-03).
- [ ] Live voice: improve voice quality and realism; verify Hinglish, interruption, meal confirm/cancel, background and error cases.
- [ ] Image: HEIC handling on iPhone, plus camera/library verification.
- [ ] Complete end-to-end Phase 3 manual verification and mark the phase `COMPLETE`.

The authoritative Phase 3 contract is documented in
`healthflip-api/docs/phase-3-ai-spec.md`. No Gemini credential is required until the
provider adapter step after the fallback API is tested.

## Product quality constraint

The first functional mobile implementation is explicitly a v0 validation build. A
boxy or utilitarian visual treatment is acceptable during flow validation, but it is
not the final product direction. Before delivery, Phase 4 must include a substantial
UX/UI refinement pass covering visual hierarchy, spacing, typography, component
consistency, native interactions, motion, empty states, loading states, error recovery,
and perceived polish. Functional completion alone does not satisfy the final quality
bar.

## Credential requests

Request credentials only at the phase where they are required. Never commit secrets.
