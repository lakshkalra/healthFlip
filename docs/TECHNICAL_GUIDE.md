# healthFlip: Technical Guide

The complete reference for how healthFlip is built: every technology and library, each AI operation, data flows, the data model, the API, native setup, testing and operations.

**Status as of 3 October 2026:**
- **Built:**
  - meal logging (manual, text and AI);
  - dashboard, progress and tips;
  - the Flip voice agent;
  - guest profiles and onboarding;
  - AI calorie and macro plans;
  - Flip memory;
  - meal plans with PDF export;
  - a meal-first minimal Home and the add-meal Flip chat (text, photo including HEIC, voice).
- **Paused (code kept, hidden in the UI):** workout plans, step targets and Apple Health steps.
- **Open:**
  - Android step counting;
  - voice quality polish;
  - production migrations;
  - pushing to GitHub.

Diagrams use [Mermaid](https://mermaid.js.org/), which GitHub and VS Code (with the Mermaid preview extension) render.

---

## Contents

1. [What healthFlip is](#1-what-healthflip-is)
2. [System architecture](#2-system-architecture)
3. [Technology stack and every library](#3-technology-stack-and-every-library)
4. [Repository layout](#4-repository-layout)
5. [Data model](#5-data-model)
6. [API reference](#6-api-reference)
7. [Identity, security and privacy](#7-identity-security-and-privacy)
8. [AI operations](#8-ai-operations)
9. [Key flows (diagrams)](#9-key-flows-diagrams)
10. [Mobile app internals](#10-mobile-app-internals)
11. [Native iOS setup](#11-native-ios-setup)
12. [Testing](#12-testing)
13. [Local development runbook](#13-local-development-runbook)
14. [Configuration reference](#14-configuration-reference)
15. [Deployment](#15-deployment)
16. [Known limitations and roadmap](#16-known-limitations-and-roadmap)
17. [Glossary](#17-glossary)

---

## 1. What healthFlip is

healthFlip is a **wellness-only** calorie and nutrition companion. It never diagnoses, prescribes or claims medical certainty. Users can:

- **Log meals** in the add-meal chat (the **+** button). Flip asks what you ate, and you answer by typing, with a camera or library photo, or by voice (the mic opens live Flip). Each estimate is confirmed with **Log it**, corrected with **Not quite**, or replaced with the manual form via **Pick from list**.
- **See today at a glance:** a minimal Home showing calories eaten and left, a progress ring, and a time-sorted list of today's meals. **Details** expands to show macro bars, Flip's nudge, and links to edit the goal or recalculate the plan. The choice is remembered on the device.
- **Get a personal plan:** a text chat with Flip asks name, age, height, weight, sex, activity and goal. AI then recommends daily calories, protein, carbs and fat. A step target is still stored, but it is hidden while the app focuses on meals.
- **Talk to Flip:** a real-time, speech-to-speech conversation (Gemini Live) that:
  - estimates meals and logs them only after the user confirms;
  - remembers lasting facts (diet, allergies, routines);
  - creates meal plans on request. Workout requests are politely declined for now.
- **Generate meal and workout plans,** save them, and **download them as a PDF**.

There is deliberately **no login**. Each install is a **guest** with a random bearer token, and everything (profile, goals, meals, memories, plans) belongs to that guest.

The project is split into two repositories:

| Repository | Purpose | Stack |
|---|---|---|
| `healthFlip` | Mobile app (iOS-first; Android not yet built) | React Native 0.87 CLI, TypeScript |
| `healthflip-api` | Backend API | Node 22+, Fastify 5, Drizzle ORM, PostgreSQL 16 |

---

## 2. System architecture

```mermaid
flowchart LR
  subgraph Phone["iPhone: healthFlip app (React Native 0.87)"]
    UI["Screens<br/>Home · Progress · Plans · Tips<br/>Onboarding · Profile · Flip"]
    AS[(AsyncStorage<br/>guest token)]
    HK[["Apple HealthKit<br/>step count"]]
    MIC[["Nitro realtime audio<br/>mic 16 kHz / speaker 24 kHz"]]
    QL[["iOS Quick Look<br/>PDF viewer"]]
  end

  subgraph API["healthflip-api (Fastify 5, Node)"]
    R["Routers → Controllers → Services"]
    G["Guardrails (zod + safety screens)"]
    P["AI provider layer<br/>Gemini · fallback"]
    PDF["pdfkit renderer"]
  end

  DB[(PostgreSQL 16<br/>Docker locally / managed in prod)]
  GREST["Gemini REST<br/>generateContent<br/>(model fallback chain)"]
  GTOK["Gemini auth_tokens<br/>(ephemeral token mint)"]
  GLIVE["Gemini Live<br/>BidiGenerateContentConstrained<br/>WebSocket"]

  UI -- "HTTPS JSON + Bearer guest token" --> R
  R --> G --> P
  R --> PDF
  R <--> DB
  P -- "API key (server only)" --> GREST
  P -- "API key (server only)" --> GTOK
  UI == "WebSocket with single-use ephemeral token<br/>PCM audio ⇄ audio + transcripts + tool calls" ==> GLIVE
  UI --> AS
  UI --> HK
  UI --> MIC
  UI --> QL
```

**Key architectural decisions:**
- **The Gemini API key never leaves the server.** For live voice, the backend mints a short-lived, single-use, **constrained** token. That token locks the model, voice, system prompt and tools. The phone then talks to Gemini Live directly, for low latency.
- **Every AI result is validated** (zod schemas plus range rules) before it is stored or shown.
- **Every AI feature has a deterministic fallback.** The app keeps working with no key, when quota is exhausted, or during an outage.
- **The backend is modular:** each module has a router, controller, service, helper and validator. Database schemas live in `src/db/schema` (one file per table) and repositories in `src/db/repositories`.

---

## 3. Technology stack and every library

### 3.1 Mobile app (`healthFlip`)

#### Runtime dependencies

| Library | Version | What it does in healthFlip | Where |
|---|---|---|---|
| `react` | 19.2.3 | UI runtime | everywhere |
| `react-native` | 0.87.1 | Native app framework (New Architecture, Hermes JS engine). Its built-in `WebSocket` (with `binaryType = 'arraybuffer'`) carries the Gemini Live connection. | everywhere, `src/voice.tsx` |
| `@react-native/new-app-screen` | 0.87.1 | Template default (unused in screens) | — |
| `react-native-safe-area-context` | ^5.5.2 | Notch and home-indicator insets for every screen | all screens |
| `@react-native-async-storage/async-storage` | ^3.1.1 | Persists the guest bearer token on the device | `src/storage/session.ts` |
| `react-native-svg` | ^15.15.5 | Vector icons (`Icon` in `ui.tsx`), the calorie progress ring, Progress charts | `src/ui.tsx`, `src/progress.tsx` |
| `react-native-reanimated` | ^4.7.1 | UI-thread animation: the Flip circular reveal, orb frame loop, shared values for mic level and word pulses | `src/flip.tsx`, `src/flipOrb.tsx`, `src/voice.tsx` |
| `react-native-worklets` | ^0.13.0 | Worklet runtime required by Reanimated 4 (Babel plugin enabled) | `babel.config.js` |
| `react-native-gesture-handler` | ^3.3.0 | Gesture infrastructure (Reanimated/FlashList dependency) | — |
| `@shopify/react-native-skia` | ^2.14.0 | GPU canvas: the **240-particle Flip orb** (depth-sorted sphere redrawn every frame on the UI thread) and the transcript's top fade gradient | `src/flipOrb.tsx`, `src/voice.tsx` |
| `@shopify/flash-list` | ^2.3.3 | Installed; no longer used after the add-meal chat moved to a plain ScrollView (safe to remove) | — |
| `react-native-nitro-modules` | ^0.36.5 | Nitro native-module runtime (JSI, near-zero bridge overhead) for the audio and HealthKit libraries | native |
| `@mindinventory/react-native-nitro-realtime-audio` | ^1.5.0 | **Live voice I/O:** 16 kHz PCM mic capture in 100 ms chunks, 24 kHz PCM playback, duplex audio session with echo cancellation, noise suppression and AGC, plus voice-activity detection (`isSpeaking`, `rms`) | `src/voice.tsx` |
| `base64-js` | ^1.5.1 | Fast base64 ⇄ bytes for PCM audio frames | `src/voice.tsx` |
| `@kingstinct/react-native-healthkit` | ^16.0.0 | **Apple Health:** request step read access and query today's cumulative `HKQuantityTypeIdentifierStepCount` | `src/steps.ts` |
| `@react-native-healthkit/core` | ^16.0.0 | Sibling core pod the HealthKit library needs. Must be a direct dependency for autolinking. | native |
| `react-native-blob-util` | ^0.25.1 | **PDF download:** fetches the plan PDF with the auth header straight to a file, then opens iOS Quick Look (Share / Save to Files / Print) or Android's PDF viewer | `src/pdf.ts` |
| `react-native-image-picker` | ^8.2.1 | Camera and photo-library selection for photo meal estimates (lazy `require`) | `src/media.tsx` |
| `react-native-speech-recognition-kit` | ^1.0.7 | Older on-device dictation path in the text assistant (lazy, optional) | `src/media.tsx` |

#### Development dependencies

| Library | Version | Purpose |
|---|---|---|
| `typescript` | ^6.0.3 | Type checking (`npx tsc --noEmit`) |
| `@react-native/typescript-config` | 0.87.1 | Base tsconfig |
| `@react-native-community/cli` (+ `cli-platform-ios`, `cli-platform-android`) | 20.2.0 | `react-native start / run-ios / run-android` |
| `@react-native/metro-config` | 0.87.1 | Metro bundler config |
| `@react-native/babel-preset`, `@babel/core`, `@babel/preset-env`, `@babel/runtime` | 0.87.1 / ^7.25 | JS transpilation, plus the Worklets plugin |
| `jest`, `@react-native/jest-preset`, `@types/jest` | ^29.6 / 0.87.1 | Unit and component tests |
| `react-test-renderer`, `@types/react-test-renderer` | 19.2.3 / ^19.1 | Rendering components in tests |
| `eslint`, `@react-native/eslint-config` | ^8.19 / 0.87.1 | Linting (`npm run lint`) |
| `prettier` | 2.8.8 | Formatting |
| `@types/react` | ^19.2 | React types |

### 3.2 Backend (`healthflip-api`)

#### Runtime dependencies

| Library | Version | What it does | Where |
|---|---|---|---|
| `fastify` | ^5.6.1 | HTTP server, routing, hooks, JSON serialisation, `inject()` for tests | `src/app.ts`, `src/modules/*/*.router.ts` |
| `@fastify/cors` | ^11.0.1 | CORS for future web clients | `src/app.ts` |
| `drizzle-orm` | ^0.45.3 | Type-safe SQL query builder and schema definitions | `src/db/**` |
| `pg` | ^8.16.3 | PostgreSQL driver (connection pool) | `src/db/client.ts` |
| `zod` | ^4.6.5 | Validates every request body and query, every AI output, and saved plan content | `*.validator.ts`, `ai.guardrails.ts`, `src/shared/plans.ts` |
| `pdfkit` | ^0.17.2 | Pure-JS PDF generation (serverless-friendly) for diet and workout plans | `src/modules/plans/plan.pdf.ts` |
| `dotenv` | ^17.2.2 | Loads `.env` in the server and the migration script | `src/server.ts`, `src/db/migrate.ts` |

#### Development dependencies

| Library | Version | Purpose |
|---|---|---|
| `typescript` | ^5.9.2 | Type checking (`npm run typecheck`) |
| `tsx` | ^4.20.5 | Runs TypeScript directly (`npm start`, `npm run dev` watch mode, tests) |
| `drizzle-kit` | ^0.31.11 | Generates SQL migrations from schema diffs |
| `@types/node`, `@types/pg`, `@types/pdfkit` | — | Types |

The test runner is Node's built-in **`node:test`** with `node:assert/strict`, so no test framework dependency is needed.

### 3.3 AI and external services

| Service | Model / endpoint | Used for |
|---|---|---|
| Gemini REST `generateContent` | Ordered fallback chain from `GEMINI_MODEL` (default chain: `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3-flash-preview`) | Meal estimates (text and photo), daily insight, plan recommendation, diet and exercise plans. Structured JSON output via `responseSchema`. |
| Gemini `auth_tokens` | `POST /v1beta/auth_tokens` | Minting single-use **ephemeral tokens** with `bidiGenerateContentSetup` constraints |
| Gemini Live | `gemini-3.8-live` over `wss://…GenerativeService.BidiGenerateContentConstrained` | Real-time speech-to-speech with Flip: input and output transcription, function calling (tools), barge-in |
| Gemini prebuilt voice | `Sulafat` (warm female; set with `GEMINI_LIVE_VOICE`) | Flip's voice. Alternatives sampled: Achernar (soft), Laomedeia (upbeat), Aoede (breezy). |
| Apple HealthKit | on-device | Step count |

### 3.4 Infrastructure and tooling

| Tool | Use |
|---|---|
| PostgreSQL 16 (Docker container `healthflip-postgres`, `postgres:16-alpine`) | Local database (`healthflip`) and test database (`healthflip_test`) |
| Xcode 26 + CocoaPods | iOS builds; `xcodebuild` + `xcrun devicectl` for device install and launch over Wi-Fi |
| Metro | JS bundler / dev server on `:8081` |
| Vercel (planned/linked) | Backend hosting; release builds point at `https://healthflip-api.vercel.app` |
| GitHub | `lakshkalra/healthFlip`, `lakshkalra/healthflip-api` |

---

## 4. Repository layout

### 4.1 Mobile: `healthFlip/`

```
App.tsx                 Root: boot, routing (tabs + sub-screens), dashboard, meal sheet, Flip overlay
src/
  api/client.ts         Typed API client: guest bootstrap, request(), every endpoint wrapper
  storage/session.ts    Guest token in AsyncStorage
  types.ts              Shared app types (Goal, Dashboard, Profile, plans, memories…)
  meals.ts              Meal types, GOALS, food presets, formatting, macroTargets fallback
  ui.tsx                Design tokens (colors), Icon set, buttons, cards, inputs, ProgressRing, MacroBar…
  onboarding.tsx        3-step onboarding (About you → Goal → AI plan) + reusable ProfileForm
  profile.tsx           "You & Flip": edit profile, recalc plan, "What Flip remembers"
  steps.ts              Apple Health access + today's steps
  plans.tsx             Plans tab: generate forms, preview, save, saved list, PDF download
  pdf.ts                Authenticated PDF download + native viewer
  flip.tsx              "Ask Flip" pill (mini orb) + circular reveal transition
  flipOrb.tsx           Skia particle orb (idle / listening / thinking / speaking / muted)
  voice.tsx             Flip live voice agent screen (Gemini Live client, tools, meal cards)
  voiceProtocol.ts      Pure Gemini Live protocol helpers (setup, audio, text, tool responses, parsing)
  assistant.tsx         Add-meal chat with Flip: meal-type picker, text/photo estimates, Log it / Not quite, mic → live Flip
  media.tsx             Photo picking + legacy dictation helpers
  progress.tsx          Progress tab (history, charts)
  tips.tsx              Tips tab (curated local content)
__tests__/              App.test.tsx (app flows), voice.test.tsx (voice agent + protocol)
jest.setup.js           Mocks: AsyncStorage, safe-area, FlashList, Nitro audio, HealthKit, blob-util, Skia, Reanimated
ios/                    Xcode project, Podfile (with HealthKit include-path fix), entitlements, Info.plist
docs/TECHNICAL_GUIDE.md This document
IMPLEMENTATION_TRACKER.md Phase-by-phase evidence log
```

### 4.2 Backend: `healthflip-api/`

```
src/
  server.ts             Loads .env, builds app, listens on HOST:PORT
  app.ts                Composition root: repositories → services → controllers → routers, error handler
  db/
    client.ts           pg Pool + drizzle client
    migrate.ts          Runs drizzle/ migrations
    schema/             One file per table (guests, guest-sessions, goals, meal-entries,
                        guest-profiles, guest-memories, wellness-plans)
    repositories/       Data access per aggregate (guest, goal, meal, profile, memory, wellness-plan)
  modules/
    guests/             POST /v1/guests, GET /v1/me
    goals/              GET|PUT /v1/goals/current (+ plan targets)
    meals/              CRUD /v1/meals
    dashboard/          GET /v1/dashboard/daily
    ai/                 Meal estimates, daily insight, live session, plan recommendation, guardrails
    profile/            GET|PUT /v1/profile
    memories/           GET|POST|DELETE /v1/memories
    plans/              Generate/save/list/get/delete plans + PDF rendering
  shared/
    ai/                 ai-provider (contracts), gemini-provider, live-session-provider,
                        fallback-provider, fallback-plans, provider-factory
    auth/guest-auth.ts  Bearer-token preHandler (sha256 lookup)
    nutrition.ts        Mifflin-St Jeor baseline (calories, macros, steps)
    plans.ts            zod schemas for plan options and content
    validation.ts, errors.ts, time.ts
drizzle/                0000 to 0005 SQL migrations + snapshots
tests/                  api.integration.test.ts + unit tests (nutrition, plans, gemini-provider,
                        live-session-provider, ai.service)
```

---

## 5. Data model

```mermaid
erDiagram
  guests ||--o{ guest_sessions : "has tokens"
  guests ||--o{ goals : "has (one active)"
  guests ||--o{ meal_entries : logs
  guests ||--o| guest_profiles : "has"
  guests ||--o{ guest_memories : "Flip remembers"
  guests ||--o{ wellness_plans : saves

  guests {
    uuid id PK
    timestamptz created_at
    timestamptz updated_at
  }
  guest_sessions {
    uuid id PK
    uuid guest_id FK
    varchar64 token_hash "sha256 of bearer token, unique"
    timestamptz revoked_at
  }
  goals {
    uuid id PK
    uuid guest_id FK
    goal_type type "lose | maintain | gain"
    int daily_calorie_target "800..6000"
    date starts_on
    int protein_target_grams "nullable (plan)"
    int carbs_target_grams "nullable (plan)"
    int fat_target_grams "nullable (plan)"
    int daily_steps_target "nullable (plan)"
    text plan_rationale "nullable (plan)"
    timestamptz archived_at "null = active"
  }
  meal_entries {
    uuid id PK
    uuid guest_id FK
    varchar120 name
    meal_source source "manual | photo | voice"
    meal_type meal_type "breakfast | lunch | snacks | dinner"
    timestamptz logged_at
    int calories_kcal
    numeric protein_grams "8,1"
    numeric carbs_grams "8,1"
    numeric fat_grams "8,1"
    timestamptz deleted_at "soft delete"
  }
  guest_profiles {
    uuid guest_id PK
    varchar60 name
    smallint age "18..100"
    profile_sex sex "female | male | unspecified"
    numeric height_cm "120..230"
    numeric weight_kg "30..300"
    activity_level activity_level "sedentary | light | moderate | active"
  }
  guest_memories {
    uuid id PK
    uuid guest_id FK
    varchar200 text
    memory_category category "diet | allergy | preference | routine | goal | other"
    timestamptz created_at
  }
  wellness_plans {
    uuid id PK
    uuid guest_id FK
    wellness_plan_kind kind "diet | exercise"
    varchar120 title
    jsonb options
    jsonb content "validated structured plan"
    wellness_plan_source source "ai | fallback"
    timestamptz created_at
  }
```

**Rules enforced in the database:**
- **One active goal per guest:** a partial unique index on `goals(guest_id) WHERE archived_at IS NULL`. Replacing a goal archives the old one in a transaction.
- **Check constraints:** the calorie target range, the profile's age, height and weight ranges.
- **Cascading deletes:** everything is deleted when its guest is deleted.
- **Memories:** deduplicated case-insensitively and capped at 50 per guest (oldest removed). Both rules live in the service layer.

### Migrations (`healthflip-api/drizzle`)

| # | File | Adds |
|---|---|---|
| 0000 | `0000_numerous_thundra.sql` | guests, guest_sessions, goals, meal_entries |
| 0001 | `0001_slow_timeslip.sql` | Check constraints: calorie target 800–6000, non-negative meal nutrition |
| 0002 | `0002_concerned_puff_adder.sql` | `meal_type` enum + `meal_entries.meal_type` column (default `snacks`) |
| 0003 | `0003_decimal_macros.sql` | macros stored as `numeric(8,1)` |
| 0004 | `0004_profile_plan_memory.sql` | guest_profiles, guest_memories, plan target columns on goals |
| 0005 | `0005_wellness_plans.sql` | wellness_plans |

Generate a migration with `npx drizzle-kit generate --name <name>` and apply it with `npm run db:migrate`.

---

## 6. API reference

All routes except `/health*` and `POST /v1/guests` require `Authorization: Bearer <guest token>`.

Errors use a single shape: `{ error: { code, message, details? }, requestId }`.

### 6.1 Health

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | Service status |
| GET | `/health/db` | Database connectivity |
| GET | `/health/ai` | `{ provider: 'gemini' \| 'fallback', live: boolean }` (never secrets) |

### 6.2 Guests and profile

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/v1/guests` | — | `{ accessToken, guest }`. The token is shown once and only its sha256 is stored. |
| GET | `/v1/me` | — | `{ guest }` |
| GET | `/v1/profile` | — | `{ profile \| null }` |
| PUT | `/v1/profile` | `{ name, age (18–100), sex, heightCm, weightKg, activityLevel }` | `{ profile }` (upsert) |

### 6.3 Goals, meals and dashboard

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/goals/current` | `{ goal \| null }`. Includes `macroTargets`, `dailyStepsTarget` and `planRationale` when set. |
| PUT | `/v1/goals/current` | `{ type, dailyCalorieTarget, startsOn?, proteinTargetGrams?, carbsTargetGrams?, fatTargetGrams?, dailyStepsTarget?, planRationale? }` |
| POST | `/v1/meals` | Create a meal (`name`, `caloriesKcal`, macros, `mealType`, `source`, `loggedAt`, `note`) |
| PATCH / DELETE | `/v1/meals/:mealId` | Edit or soft-delete |
| GET | `/v1/dashboard/daily?date&timezone` | `{ dashboard: { date, goal (with plan targets), meals, totalCalories, remainingCalories, timezone } }` |

### 6.4 AI

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/v1/ai/meal-estimate` | `{ description (3–500), mealType? }` | `{ estimate: { name, caloriesKcal, proteinGrams, carbsGrams, fatGrams, confidence, assumptions[], source } }` |
| POST | `/v1/ai/meal-estimate-image` | `{ imageBase64 (≤1.5 MB), mimeType: jpeg\|png\|webp, mealType? }` | `{ estimate }` |
| GET | `/v1/ai/daily-insight?date&timezone` | — | `{ insight: { message, nextAction, source } }` |
| POST | `/v1/ai/plan-recommendation` | `{ goalType }` | `{ recommendation: { dailyCalorieTarget, proteinGrams, carbsGrams, fatGrams, dailySteps, rationale, source } }`. Returns 409 `PROFILE_REQUIRED` if there is no profile. |
| POST | `/v1/ai/live-session` | `{ date, timezone }` | `{ session: { token, expiresAt, model, websocketUrl } }` |

### 6.5 Memories

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/memories` | Newest first |
| POST | `/v1/memories` | `{ text (2–200), category }`. Returns 201 when new, 200 for a duplicate, 422 `MEMORY_BLOCKED` for injection or medical text. |
| DELETE | `/v1/memories/:id` | 204; 404 if it belongs to someone else |

### 6.6 Diet and exercise plans

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/plans/generate` | `{ kind: 'diet', options: { days 1\|3\|7, dietType, cuisine, notes? } }` or `{ kind: 'exercise', options: { daysPerWeek 2–6, location, level, minutesPerSession 15–90, notes? } }`. Returns an **unsaved** `{ plan: draft }`. |
| POST | `/v1/plans` | Saves a draft; the content is **re-validated**. Returns 201 `{ plan }`. |
| GET | `/v1/plans` | Summaries `{ id, kind, title, summary, source, createdAt }` |
| GET | `/v1/plans/:id` | Full plan |
| GET | `/v1/plans/:id/pdf` | `application/pdf` with `Content-Disposition: attachment; filename="<slug>.pdf"` |
| DELETE | `/v1/plans/:id` | 204 |

### 6.7 Common error codes

| Code | Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or unknown guest token |
| `VALIDATION_ERROR` | 400 | zod validation failed (`details` lists the paths) |
| `NOT_FOUND` | 404 | Resource missing or not owned by this guest |
| `PROFILE_REQUIRED` | 409 | A plan was requested before a profile exists |
| `AI_SAFETY_BLOCKED` | 422 | Prompt injection, or a medical/eating-disorder request |
| `MEMORY_BLOCKED` | 422 | Unsafe memory text |
| `AI_IMAGE_TOO_LARGE` | 413 | Photo over the limit |
| `AI_PROVIDER_QUOTA_EXCEEDED` | 429 | Every model in the chain is out of quota |
| `AI_PROVIDER_TIMEOUT` | 504 | The AI took too long |
| `AI_OUTPUT_INVALID` | 502 | The AI returned malformed or out-of-range output |
| `AI_PROVIDER_UNAVAILABLE` | 503 | Provider down or not configured |

---

## 7. Identity, security and privacy

- **Guest identity:**
  - `POST /v1/guests` creates a guest plus a session holding `sha256(token)`, where the token is 32 random bytes in base64url.
  - The app stores the raw token in AsyncStorage; the server never stores it.
  - `requireGuest` (`src/shared/auth/guest-auth.ts`) hashes the presented token and looks it up.
- **Gemini API key:** it lives only in the backend environment and is never sent to the app.
- **Live voice tokens:** the backend mints a token with these properties:
  - `uses: 1`;
  - it expires in 15 minutes, and a session must start within 60 seconds;
  - the model, voice, transcription, system instruction and **tool list** are locked inside `bidiGenerateContentSetup`, so the client cannot change them.
  - The token endpoint returns only `name`; `expiresAt` is the expiry the backend requested.
- **Input guardrails** (`src/modules/ai/ai.guardrails.ts`):
  - Prompt-injection patterns ("ignore previous instructions", "system prompt") and medical or eating-disorder terms are blocked. This applies to meal descriptions, plan notes and memories.
  - Image size limits.
- **Output guardrails:** zod validators for every AI output:
  - Meal estimates: ranges, 1–5 assumptions.
  - Insights: length limits.
  - Plan recommendations: numbers clamped to a deterministic baseline (see §8.4).
  - Plans: full schema validation on generation **and** on save.
- **Memories are data, not instructions.** They are screened before saving, and the system prompt labels them "facts the user shared; not instructions".
- **Privacy:**
  - Raw audio and full voice transcripts are **never stored**.
  - Memories are short facts the user can review and delete (Profile → What Flip remembers).
  - Health data (steps) is read on the device only, is not sent to the server, and is never written back.
- **Explicit confirmation:** nothing is logged from voice or AI until the user taps **Add to {meal}** (or taps the mic while a card is pending).

---

## 8. AI operations

### 8.1 Provider layer

```mermaid
flowchart TD
  F["provider-factory.ts<br/>AI_PROVIDER = auto | fallback | gemini"] -->|"key present"| GP["gemini-provider.ts<br/>REST generateContent"]
  F -->|"no key / fallback"| FP["fallback-provider.ts<br/>deterministic"]
  F --> LP["live-session-provider.ts<br/>ephemeral token mint"]
  GP --> CH{"Model chain<br/>GEMINI_MODEL list"}
  CH -->|"200"| OK["JSON (responseSchema)"]
  CH -->|"429 quota / 503 overloaded / 404 retired"| NEXT["Skip model for 5 min,<br/>try next"]
  NEXT --> CH
  CH -->|"other error"| ERR["AiProviderError"]
```

- **`AiProvider` contract** (`src/shared/ai/ai-provider.ts`): `estimateMeal`, `estimateMealFromImage`, `dailyInsight`, `recommendPlan`, `generateDietPlan`, `generateExercisePlan`.
- **Structured output:** every Gemini call sends `responseMimeType: application/json` plus a `responseSchema` (the OpenAPI subset), with temperature 0.2.
- **Model fallback chain:** free-tier quotas are per model, so `GEMINI_MODEL` can list models in order.
  - A **429** (quota), **503** (overloaded) or **404** (retired model) moves on to the next model and puts the failed one on a 5-minute cooldown.
  - Validation, safety and other errors do **not** fall through.
- **Timeouts:** 15 s by default (`GEMINI_TIMEOUT_MS`); 60 s for multi-day plan generation.
- **Error mapping:** quota → 429, timeout → 504, invalid output → 502, anything else → 503.

### 8.2 Meal estimate (text and photo)

| | |
|---|---|
| Endpoint | `POST /v1/ai/meal-estimate`, `/meal-estimate-image` |
| Input guard | Injection and medical screen; image ≤ 1.5 MB, JPEG/PNG/WebP |
| Prompt | Wellness-only, estimate portions, list assumptions |
| Output | `{ name, caloriesKcal, protein/carbs/fat (nullable), confidence, assumptions[1–5] }`, validated |
| Fallback | Keyword-based profiles (e.g. dal/paneer → ~420 kcal) with `confidence: low` |
| Used by | Text chat, the voice meal card, the photo flow |

### 8.3 Daily insight ("Flip's nudge")

The backend loads the day's context: goal plus plan targets, the day's meals, profile and memories. Gemini returns a short `message` and `nextAction`, which are validated for length. The fallback is rule-based on meal count versus target, and never shames.

### 8.4 Personal plan recommendation (calories, macros, steps)

**Deterministic baseline** (`src/shared/nutrition.ts`):

| Step | Formula |
|---|---|
| BMR (Mifflin-St Jeor) | `10·kg + 6.25·cm − 5·age + s`, where s = +5 male, −161 female, −78 unspecified |
| TDEE | BMR × activity factor: sedentary 1.2, light 1.375, moderate 1.55, active 1.725 |
| Goal adjustment | lose: TDEE − 500, never below **max(BMR, 1200)**; gain: TDEE + 300; maintain: TDEE. Rounded to 50 and clamped to 800–6000. |
| Protein | 1.6 g/kg (1.8 when losing or gaining), capped at 35% of kcal |
| Fat | 27% of kcal |
| Carbs | The remainder |
| Steps | sedentary 6k, light 7.5k, moderate 9k, active 10k; +1.5k when losing; capped at 12k |

**AI personalisation and guard:**
- Gemini receives the profile plus the baseline. It returns the five targets and a warm rationale (≤ 280 chars) that addresses the user by first name.
- `guardPlanOutput` accepts the AI's numbers only if:
  - calories are within **±10%** of the baseline and above the floor;
  - macro kcal (`4P + 4C + 9F`) is within ±10% of the calories;
  - steps are between 3k and 20k.
- Otherwise the baseline numbers are used and the AI's wording is kept.
- If the AI fails for any reason, the deterministic plan is returned, so onboarding never blocks.

Example (real Gemini): a 30-year-old man, 75 kg, 178 cm, moderately active, maintaining, gets 2,650 kcal and 10k steps. A 27-year-old sedentary woman losing weight gets 1,400 kcal, exactly at her floor.

### 8.5 Diet and exercise plan generation

| | Diet | Exercise |
|---|---|---|
| Options | days 1/3/7, dietType (vegetarian, non-vegetarian, vegan, eggetarian, any), cuisine, notes | daysPerWeek 2–6, location (home, gym, outdoors), level, minutesPerSession 15–90, notes |
| Context | Profile, goal calories/macros/steps, up to 30 memories | Same |
| Content | `title, summary, dailyCalories, macros, days[{label, meals[{type, name, portion, calories, proteinGrams}]}], tips[]` | `title, summary, days[{label, focus, rest, durationMinutes, exercises[{name, detail}]}], tips[]` |
| Prompt rules | Each day within ~5% of target; realistic home portions; **leave out allergens and disliked foods without naming them**; vary meals | Exactly N training days with rest days between; warm-up; location-appropriate equipment; joint-friendly options for beginners |
| Fallback | Indian meal templates scaled 25/35/10/30% across breakfast, lunch, snack and dinner, filtered by diet type **and by foods memories say to avoid** | A 7-day template by location and level with a rotating focus and no repeated exercises |
| Validation | zod content schema on generation and on save | Same |

Measured with real Gemini: a 7-day vegetarian plan in about 7 s (each day within 10 kcal of 1,600, peanut-free for a peanut-allergy memory); a 4-day home workout in about 4 s.

### 8.6 Flip live voice (Gemini Live)

| Aspect | Implementation |
|---|---|
| Transport | Built-in RN `WebSocket` to the `BidiGenerateContentConstrained` URL with `?access_token=<ephemeral>`. `binaryType = 'arraybuffer'`, because **every server message arrives as a binary frame of UTF-8 JSON**. |
| Setup | The client sends only `{ setup: { model } }`; everything else is locked in the token. Other top-level fields are rejected (close code 1007). |
| Ordering | Native audio (mic and player) starts only **after `setupComplete`** |
| Input audio | 16-bit PCM, 16 kHz mono, 100 ms chunks, `audio/pcm;rate=16000`; echo cancellation, noise suppression and AGC on |
| Output audio | 24 kHz PCM played through the Nitro player; `interrupted` stops playback (barge-in) |
| Transcripts | Input and output transcription fragments accumulate per turn and type in with a caret |
| States | idle → connecting → listening ⇄ thinking (local VAD: user stopped, Flip hasn't answered) → speaking; plus a muted overlay |
| Mute | Streams **silence** instead of mic audio. Gemini only closes a turn after about 1 s or more of silence; both stopping audio and `audioStreamEnd` left the last sentence unanswered (verified). |
| Voice and persona | Sulafat; "warm, sweet and calming, with gentle enthusiasm"; answers in the user's language, including Hinglish and Hindi |
| Context | Name, profile, today's goal and meals, remembered facts (as data) |
| Failure handling | A close before setup shows an error state with the reason; `goAway` produces a time-limit message; an attempt counter discards stale async work |

**Tools (function calling)**, declared in the token:

| Tool | Gemini calls it when… | App does | Response to Gemini |
|---|---|---|---|
| `show_meal_card { description, mealType? }` | The user says they ate something (any language; the description comes back in English) | `POST /v1/ai/meal-estimate`, then shows a meal card; logging still needs a tap | The estimate numbers plus "waiting for the user to tap Add", or `{ error }` (e.g. quota reason) |
| `save_memory { text, category }` | The user shares a lasting diet, allergy, preference, routine or goal | `POST /v1/memories`, then shows a "Remembered: …" note | `{ saved, text }` or `{ error }` |
| `create_plan { kind, days?, dietType?, cuisine?, daysPerWeek?, location?, level?, minutesPerSession?, notes? }` | The user asks for a diet or workout plan | Generate, then save, then a "Saved '…' to Plans" note; the Plans tab refreshes | `{ saved, title, summary, kind, days }` or `{ error }` |

A keyword fallback for meal cards stays active until the session's first tool call, so the two paths can't produce duplicate cards.

Measured (synthesized speech): setup takes about 1.3–2.4 s; first reply audio about 1.2 s after the user stops speaking; tool calls arrive in the same instant as the user transcript.

---

## 9. Key flows (diagrams)

### 9.1 App boot and onboarding

```mermaid
flowchart TD
  A[App launch] --> B{Guest token<br/>in AsyncStorage?}
  B -- no --> C[POST /v1/guests<br/>save token]
  B -- yes --> D
  C --> D["Parallel: GET /v1/goals/current + GET /v1/profile"]
  D -->|network error| E[Boot error card + Retry]
  D --> F{Profile?}
  F -- no --> G[Onboarding: About you]
  F -- yes --> H{Goal?}
  H -- no --> I[Onboarding: Your goal]
  H -- yes --> J[Home dashboard]
  G -->|PUT /v1/profile| I
  I --> K["Your plan: POST /v1/ai/plan-recommendation"]
  K --> L[Adjust calories, macros rescale]
  L -->|"PUT /v1/goals/current with targets"| J
  J --> M[Dashboard + insight + Apple Health steps]
```

### 9.2 Manual or AI meal logging

```mermaid
sequenceDiagram
  actor U as User
  participant App
  participant API
  participant AI as Gemini (model chain)
  U->>App: Describe meal / pick preset / photo
  App->>API: POST /v1/ai/meal-estimate (or -image)
  API->>API: guardMealDescription / guardImageInput
  API->>AI: generateContent + responseSchema
  AI-->>API: JSON estimate
  API->>API: guardMealEstimateOutput (zod)
  API-->>App: estimate (+ assumptions, confidence)
  U->>App: Review / edit, tap Save
  App->>API: POST /v1/meals
  App->>API: GET /v1/dashboard/daily (refresh)
```

### 9.3 Flip live voice session

```mermaid
sequenceDiagram
  actor U as User
  participant App as App (voice.tsx)
  participant API as healthflip-api
  participant GT as Gemini auth_tokens
  participant GL as Gemini Live (WebSocket)
  U->>App: Tap mic
  App->>App: Request microphone permission
  App->>API: POST /v1/ai/live-session {date, timezone}
  API->>API: Load profile, goal, meals, memories
  API->>GT: Mint token (uses:1, model, voice, prompt, tools locked)
  GT-->>API: { name }
  API-->>App: { token, websocketUrl, model, expiresAt }
  App->>GL: Connect ?access_token=…
  App->>GL: { setup: { model } }
  GL-->>App: setupComplete (binary JSON)
  App->>App: Start duplex audio session, 24 kHz player, 16 kHz recorder
  loop Conversation
    App->>GL: realtimeInput.audio (PCM 16 kHz, 100 ms)
    GL-->>App: inputTranscription fragments
    GL-->>App: modelTurn audio (PCM 24 kHz) + outputTranscription
    App->>U: Play audio, type transcript, animate orb
    GL-->>App: interrupted (barge-in) → stop playback
  end
  U->>App: End / close
  App->>App: Close socket, stop recorder/player, nothing persisted
```

### 9.4 Voice meal card (tool call)

```mermaid
sequenceDiagram
  actor U as User
  participant GL as Gemini Live
  participant App
  participant API
  U->>GL: "Maine lunch mein do roti aur dal khayi"
  GL-->>App: toolCall show_meal_card {description:"two rotis and dal", mealType:"lunch"}
  App->>API: POST /v1/ai/meal-estimate
  API-->>App: estimate
  App->>U: Meal card (Add to Lunch)
  App->>GL: toolResponse {caloriesKcal, …, status:"waiting for tap"}
  GL-->>U: "About 330 kcal, tap Add to confirm"
  U->>App: Tap Add to Lunch (or mic)
  App->>API: POST /v1/meals (source: voice)
  App->>U: "Done. Lunch is logged. You have N kcal left today."
```

### 9.5 Memory

```mermaid
flowchart LR
  S["User: 'I'm vegetarian and gym at 7'"] --> T["Gemini: save_memory ×2<br/>Vegetarian (diet)<br/>Goes to the gym at 7am (routine)"]
  T --> A["App: POST /v1/memories"]
  A --> G{"guardMemoryText<br/>dedupe · cap 50"}
  G -- ok --> DB[(guest_memories)]
  G -- blocked --> E["422 → error back to Gemini"]
  DB --> N["Next live session / plan / insight:<br/>memories injected as data"]
  DB --> P["Profile → What Flip remembers<br/>(view / delete)"]
```

### 9.6 Diet / exercise plan → PDF

```mermaid
sequenceDiagram
  actor U as User
  participant App as Plans tab
  participant API
  participant AI as Gemini
  U->>App: New meal plan (7 days, veg, Indian, notes)
  App->>API: POST /v1/plans/generate
  API->>API: guardPlanNotes, load profile/goal/memories
  API->>AI: generateContent (60 s timeout, plan schema)
  alt AI ok & schema-valid
    AI-->>API: plan JSON
  else error / invalid
    API->>API: Template plan (filters avoided foods)
  end
  API-->>App: draft (not saved)
  U->>App: Save plan
  App->>API: POST /v1/plans (re-validated)
  U->>App: Download PDF
  App->>API: GET /v1/plans/:id/pdf (Bearer, via blob-util to file)
  API->>API: pdfkit render (A4)
  API-->>App: application/pdf
  App->>U: iOS Quick Look → Share / Save to Files / Print
```

### 9.7 Steps (paused)

> Steps are hidden while healthFlip focuses on meals. `src/steps.ts` and HealthKit stay installed but are no longer called from `App.tsx`. The flow below describes the earlier behaviour, kept for when steps return.

```mermaid
flowchart TD
  H[Home loads / app returns to foreground / pull to refresh] --> A{Apple Health available?}
  A -- no / Android --> T[Show target only: 9,000 steps a day]
  A -- yes --> B{Authorization requested before?}
  B -- no --> C[Connect Apple Health button]
  C -->|requestAuthorization toRead StepCount| B
  B -- yes --> Q[queryStatisticsForQuantity<br/>cumulativeSum since midnight]
  Q --> R["4,321 / 9,000 steps + progress bar"]
```

---

## 10. Mobile app internals

### 10.1 Navigation

`App.tsx` holds a `route` state rather than a navigation library:
- **Tabs:** `home`, `progress`, `plans`, `tips`.
- **Sub-screens:** `boot`, `onboarding`, `profile`, `goal`, `detail`, `assistant`.

Tab screens stay mounted (hidden) to preserve their state. **Flip** is an overlay (`FlipReveal`) on top of whatever route is showing, so the circular reveal shows the screen underneath.

```mermaid
flowchart LR
  Boot --> Onboarding --> Home
  Home <--> Progress
  Home <--> Plans
  Home <--> Tips
  Home --> Profile
  Home --> MealDetail
  Home --> GoalEdit
  Home -->|Ask Flip pill| Flip((Flip overlay))
  Flip -->|keyboard| Assistant[Text chat]
  Assistant -->|Talk live| Flip
  Profile -->|Recalculate| Onboarding
```

### 10.2 State and data

- **Server state:**
  - It is loaded via `src/api/client.ts` and held in `useState` in `Root`: dashboard, profile, insight and steps.
  - It is refreshed after mutations.
  - Version counters (`historyVersion`, `plansVersion`) tell cached tabs to refetch.
- **The `request()` helper** adds JSON headers and the guest bearer token. It throws `Error(message)` with the server's readable message.
- **Development API host:** derived from Metro's script URL, falling back to the Mac's Wi-Fi IP. Release builds use `https://healthflip-api.vercel.app`.

### 10.3 Flip UI components

- **`ParticleOrb`** (`flipOrb.tsx`):
  - 240 points on a sphere, drawn with Skia `PictureRecorder` inside a Reanimated `useDerivedValue`.
  - `useFrameCallback` advances time, rotation and smoothed amplitude: `amp += (target − amp)·min(1, dt·10)`; the speaking pulse decays by `0.03^dt`.
  - Mic RMS (×6) and per-word pulses are Reanimated shared values, so no React re-renders happen per frame.
  - Muted freezes the loop and draws greyscale. The mini variant (90 points) sits in the Ask Flip pill.
- **`FlipReveal`** (`flip.tsx`): a 550 ms `cubic-bezier(.6,0,.2,1)` circular clip, built as a growing rounded container with a counter-offset child.
- **Transcript:** Flip's lines have no bubble (20/600); user bubbles are dark with radius 22/22/6/22. Lines type in with a 2 px caret, and full text is exposed through accessibility labels.
- **Meal card:** meal-type tag, protein, the dish with its portion and kcal, a dashed divider, the total, and **Add to {meal}**, which becomes "Logged to {meal}".

### 10.4 Design tokens (`src/ui.tsx`)

| Token | Value |
|---|---|
| Background | `#f5f7f1` |
| Ink | `#1c1f1a` |
| Muted | `#5c6157` |
| Lime | `#b7e36a` / `#d9f0a8` |
| Greens | `#7fbf2a`, `#3d5a12`, `#9fd34a` |
| Pale | `#e4f4c6`, selected `#f2fadf` |
| Protein | `#8a63d2` |
| Carbs | `#e3a12f` |
| Fat | `#3a86d1` |
| Danger | `#c4452f` |

Fonts are the system font for now; Figtree, which the design specifies, is not yet bundled.

---

## 11. Native iOS setup

| Item | Where | Why |
|---|---|---|
| `NSMicrophoneUsageDescription` | `ios/healthFlip/Info.plist` | Live voice |
| `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` | Info.plist | Meal photos |
| `NSLocalNetworkUsageDescription` | Info.plist | Dev: reach Metro and the API on the Mac |
| `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` | Info.plist | Read steps (never writes) |
| `com.apple.developer.healthkit` entitlement | `ios/healthFlip/healthFlip.entitlements` (`CODE_SIGN_ENTITLEMENTS`) | HealthKit capability (accepted by the signing team `4SJP58N7W5`) |
| Podfile `post_install` | `ios/Podfile` | Adds `@react-native-healthkit/core/ios` to the `ReactNativeHealthkit` target's `SWIFT_INCLUDE_PATHS`. Core imports a private Swift module that dependents must resolve under explicit module builds. |
| `ENABLE_USER_SCRIPT_SANDBOXING = NO` | Xcode project | React Native writes `ip.txt` during the build |

**When a native rebuild is required:** after adding or upgrading any library with native code (Skia, Nitro, HealthKit, blob-util…). A Metro reload only updates JavaScript. When native code is missing at runtime, the symptom is an error like `cannot read properties of undefined (VoiceConversationScreen)`.

**Build and install over Wi-Fi** (the RN CLI doesn't see Wi-Fi devices):

```bash
cd healthFlip/ios && pod install
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -workspace healthFlip.xcworkspace -scheme healthFlip -configuration Debug \
  -destination 'id=<DEVICE_UDID>' -derivedDataPath /tmp/healthflip-dd -allowProvisioningUpdates build
xcrun devicectl device install app --device <DEVICE_UDID> /tmp/healthflip-dd/Build/Products/Debug-iphoneos/healthFlip.app
xcrun devicectl device process launch --device <DEVICE_UDID> --terminate-existing org.reactjs.native.example.healthFlip
```

Alternatively, open `ios/healthFlip.xcworkspace` in Xcode, select the iPhone, and press Run.

---

## 12. Testing

| Suite | Command | Covers |
|---|---|---|
| API typecheck | `npm run typecheck` | — |
| API unit tests | `node --import tsx --test tests/nutrition.test.ts tests/plans.test.ts tests/gemini-provider.test.ts tests/live-session-provider.test.ts tests/ai.service.test.ts` | Nutrition math (hand-computed cases); the plan guard; fallback plans for every diet type and duration (vegan/veg exclusions, allergen filtering, no repeated exercises); PDF rendering (including non-Latin names); file-name slugs; model fallback (429/503/404 fall through, others don't, cooldown); live token payload (`bidiGenerateContentSetup`, voice, the 3 tools, name and memories in the prompt); provider error mapping |
| API integration | `TEST_DATABASE_URL=postgres://healthflip:healthflip@127.0.0.1:5432/healthflip_test npm run test:integration` | Real Postgres via `app.inject`, on the fallback provider: guests and auth; goals with plan targets; meals with decimal macros; dashboard; AI guardrails (422/413); profile (18+); memories (dedupe, cap of 50, injection blocked, cross-guest 404); plan recommendation (2,650 kcal case, 409 without a profile); plans generate/save/list/get/PDF/delete, tampered content and unsafe notes |
| Mobile | `npx tsc --noEmit && npm run lint && npm test -- --runInBand --watchman=false` | **App:** offline boot; full onboarding (validation, plan, save → Home); live steps; dashboard; Progress; Plans (create → preview → save → PDF download via blob-util and Quick Look); Tips. **Voice:** setup ordering; binary frames; fragments; meal card and confirm; mic-confirm; close/mute/VAD thinking; chips; mic denial; keyboard handoff; `show_meal_card` (including Hindi); errors returned to Gemini; `save_memory`; `create_plan`; argument mapping. |

Latest counts: API unit **20/20**, integration **19/19**; mobile **27/27**.

**Real-API probes:** Node scripts streamed `say`-generated speech (English, Indian English and Hindi) to Gemini Live using backend-minted tokens. They verified:
- the setup shape and binary frames;
- transcripts, tool calls, voice samples and latency;
- that mute (silence) closes turns;
- plan quality and allergen handling.

**Jest mocks** (`jest.setup.js`): AsyncStorage, safe-area, FlashList, Nitro audio, HealthKit (unavailable by default), blob-util, Skia (inert canvas), and Reanimated (stable `useSharedValue`, inert frame callbacks).

---

## 13. Local development runbook

```bash
# 1. Database
docker start healthflip-postgres            # first time: docker compose up -d postgres (in healthflip-api)

# 2. Backend
cd healthflip-api
npm install
npm run db:migrate
npm run dev                                 # or npm start; HOST=0.0.0.0 so the phone can reach it
curl http://127.0.0.1:3000/health/ai        # {"provider":"gemini","live":true}

# 3. Metro
cd ../healthFlip && npm install && npm start

# 4. App
# Debug build already installed: open it on the phone (shake → Reload to refresh JS)
# After native changes: pod install + rebuild (see §11)
```

**Troubleshooting:**

| Symptom | Cause / fix |
|---|---|
| App says it can't reach the backend | The API is listening on `127.0.0.1`. Set `HOST=0.0.0.0` in `.env`, then restart. |
| Metro says "No apps connected" | Open the app on the phone; it connects on launch. |
| `cannot read properties of undefined (…Screen)` | The native build is older than a native library. Rebuild. |
| No meal card or estimates | Check `/v1/ai/meal-estimate`. A 429 means the quota is exhausted; extend the model chain or enable billing. |
| Live voice closes immediately (1007) | Client setup contains fields not allowed with constrained tokens. Send only `{model}`. |
| `pod install`: unable to find `ReactNativeHealthkitCore` | `@react-native-healthkit/core` must be a direct dependency. |
| Build: `Unable to resolve module dependency 'ReactNativeHealthkitCore_Private'` | Podfile include-path fix (§11) |

---

## 14. Configuration reference

### Backend `.env`

| Variable | Example | Meaning |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address (`0.0.0.0` lets the phone reach it) |
| `PORT` | `3000` | |
| `NODE_ENV` | `development` | |
| `DATABASE_URL` | `postgres://healthflip:healthflip@localhost:5432/healthflip` | |
| `AI_PROVIDER` | `auto` / `gemini` / `fallback` | `auto` uses Gemini when a key exists |
| `GEMINI_API_KEY` | (secret) | Server-only. Never commit it. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite,gemini-3.1-flash-lite,…` | One model or an ordered fallback chain |
| `GEMINI_LIVE_MODEL` | `gemini-3.8-live` | Live voice model |
| `GEMINI_LIVE_VOICE` | `Sulafat` | Prebuilt voice |
| `GEMINI_TIMEOUT_MS` | `15000` | Default REST timeout (plans use 60 s) |
| `TEST_DATABASE_URL` | `postgres://…/healthflip_test` | Integration tests only |

### Free-tier quotas observed (Google AI Studio)

| Model | Requests/min | Requests/day |
|---|---|---|
| Gemini 3.5 Flash Lite, 3.1 Flash Lite | 15 | 50 |
| Gemini 3.8 / 3.7 / 3.6 / 3.5 / 3 Flash | 5 | 20 |
| Gemini 3.8 Live | 5 | unlimited |

---

## 15. Deployment

- **Backend → Vercel** (the project is linked; `src/app.ts` exports a Vercel-compatible handler).
  1. Set `DATABASE_URL` (managed Postgres) and the `GEMINI_*` and `AI_PROVIDER` variables in Vercel.
  2. **Apply migrations 0003–0005 to production** before or with the deploy: `DATABASE_URL=<prod> npm run db:migrate`.
  3. Pushing `main` may deploy automatically if the Vercel Git integration is on.
- **Mobile:** release builds call the Vercel URL. Android APK and iOS release builds are planned for the delivery phase.
- **Git:** both repositories have local commits that are not pushed yet. Run `gh auth login`, then `gh auth setup-git`, then `git push origin main`. Commits are made under the owner's identity.

---

## 15b. Health reports, water reminders and the widget

**Reports** (`src/reports.tsx`, API `src/modules/reports/`):
- **Upload:** photos (up to 5 pages, 1700 px) or one PDF; one upload stays under ~3 MB because Vercel caps request bodies at 4.5 MB (`@react-native-documents/picker`, read as base64 with blob-util).
- **Reading:** `POST /v1/reports/extract` sends the pages inline to Gemini (`extractReport`, 60 s). It returns a draft and **stores nothing**: no file and no values.
- **Review:** you untick misread values, then `POST /v1/reports` re-screens and saves only the confirmed values in `health_reports`.
- **Safety rules** (prompt plus `guardReportOutput`):
  - values, units and ranges are copied exactly;
  - flags come only from the printed range, and `unknown` is used when there is none;
  - the fallback provider refuses rather than inventing values;
  - nutrition notes and summaries that mention medication, doses or diagnoses are dropped or replaced;
  - **no water goal is suggested when creatinine, eGFR, urea, BNP, sodium or potassium is flagged**;
  - critical results set `urgent`, which shows a "contact your doctor" banner.
- **Personalisation:** `healthNotesFrom(latest report)` gives up to 8 lines (flagged values, then food notes). These are passed as data to:
  - meal estimates (`healthTip`);
  - the daily nudge;
  - the Live voice instruction;
  - diet plans (`useHealthNotes`, on by default when a report exists).
- Memories still refuse medical details.

**Water** (`water_targets`, `water_logs`, `/v1/water*`):
- The dashboard returns `water` and `latestReport`.
- The Home `WaterCard` offers +250 ml (long-press +500) and undo; the ⋯ menu sets the interval, turns reminders off, changes the goal or removes it.

**Native (iOS)**, `ios/healthFlip/HealthFlipNative.swift` registered via `HealthFlipNative.m`:
- `scheduleReminders` / `cancelReminders`: repeating `UNCalendarNotificationTrigger`s, ids prefixed `water-`. They show as banners even in the foreground, through the AppDelegate's `UNUserNotificationCenterDelegate`.
- `updateWidget(json)`: writes the snapshot to App Group `group.org.reactjs.native.example.healthFlip` and reloads WidgetKit timelines.
- `takeLaunchURL`: the `healthflip://` link that cold-started the app. SceneDelegate also forwards links while the app is running as `RCTOpenURLNotification`.

**Widget** (`ios/HealthFlipWidget/`, an iOS 17+ WidgetKit extension):
- **Sizes:** small (ring, kcal, water), medium (ring, Log meal, P/C/F bars, water, nudge or next reminder), and Lock Screen circular/rectangular.
- **Refresh:** every 30 min and just after midnight. A snapshot from an earlier day is shown as a fresh day.
- **Links:** `healthflip://log-meal`, `healthflip://water`, `healthflip://home`.
- **Project setup:** `ios/scripts/add-widget-target.rb` (xcodeproj gem, safe to re-run) adds the native files and the widget target.

```mermaid
flowchart LR
  Upload["Photos / PDF"] --> Extract["/v1/reports/extract<br/>Gemini + guardrails"]
  Extract --> Review["Review: untick values,<br/>accept water goal"]
  Review --> Save[("health_reports")]
  Save --> Notes["healthNotesFrom()"]
  Notes --> Tips["Meal healthTip · nudge · voice · meal plans"]
  Review --> Water["water_targets"] --> Remind["Local reminders<br/>(HealthFlipNative)"]
  Dash["Dashboard"] --> Widget["App Group snapshot → WidgetKit"]
```

## 16. Known limitations and roadmap

| Area | Status / next step |
|---|---|
| Photo meal estimate on iPhone | **Fixed in code.** The app detects the real format from the file header, and the API accepts HEIC/HEIF, which Gemini reads natively (verified with a real HEIC). Large library photos get one smaller re-pick. Still needs a camera check on the iPhone. |
| Workouts and steps | Paused. Plans offer meal plans only, voice `create_plan` is diet-only, and Home shows no steps. Bring them back when the meal flow is settled. |
| Android | Not yet built. Step counting needs Health Connect (the current library requires Expo). |
| Voice quality and realism | Works (v0). Tune voice choice, persona and pacing; consider Gemini affective dialogue. |
| Quota | The free tier is small. The model chain helps; billing is the real fix. |
| Fonts | The design specifies Figtree; not yet bundled. |
| Plans | No editing or regeneration of single days yet; PDFs use Latin fonts (English content). |
| Memory | No automatic expiry or consolidation; capped at 50. |
| Auth | Guest-only by design. Reinstalling the app starts a new guest (no account recovery). |
| Production | Migrations 0004–0005 pending; pushes pending. |

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **Flip** | healthFlip's AI coach (voice and text) |
| **Guest** | An anonymous user identified by a random bearer token |
| **Ephemeral token** | A short-lived, single-use Gemini Live token minted by the backend; it locks model, voice, prompt and tools |
| **Constrained endpoint** | `BidiGenerateContentConstrained`, the Live WebSocket that accepts ephemeral tokens |
| **Tool / function call** | The model asking the app to run `show_meal_card`, `save_memory` or `create_plan` |
| **VAD** | Voice activity detection; it detects when the user starts and stops talking |
| **Barge-in** | The user interrupting Flip; Gemini sends `interrupted` and playback stops |
| **BMR / TDEE** | Basal metabolic rate / total daily energy expenditure |
| **Fallback provider** | The deterministic implementation used without a key or when the AI fails |
| **Model chain** | An ordered list of Gemini models tried in turn on quota or overload errors |
| **Draft plan** | A generated plan that hasn't been saved yet |
