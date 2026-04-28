# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lumen (Coverage Ghost) is an AI-powered spatial insurance claims companion built for XRCC 2026 (PICO / WebSpatial track). It lets field insurance agents scan a damaged vehicle in WebXR, runs AI damage analysis + coverage decisions against a sample policy, and displays the results overlaid on a 3D Gaussian splat — viewable on Meta Quest or PICO headsets.

## Current Hardware Target
Primary development and testing device is **Meta Quest** (Chromium-based browser). Apple Vision Pro was tested but dropped — visionOS Safari blocks live camera feed rendering in web pages. Meta Quest Browser supports `getUserMedia`, `capture="environment"` file inputs, and WebXR — all required for the full demo flow.

**Note:** Web Speech API is NOT available on Meta Quest Browser (Google proprietary). Voice notes use **Vosk WASM** (`vosk-browser` npm package) — offline, free, no API key required.

---

# LUMEN — High Level Design
**XRCC 2026 Hackathon | Pico Tech Track**

## What is LUMEN?

LUMEN is a spatial insurance damage assessment application that runs in the browser on Meta Quest and PICO — no installation required. A field insurance agent puts on a headset, captures a damaged vehicle in AR, reviews an AI-generated Gaussian splat in immersive 3D, records voice-annotated damage notes, and submits a structured insurance claim report — all from a single spatial web experience.

## Hackathon Track

**Pico Tech Track — Path 1: WebSpatial**

| Requirement | How LUMEN meets it |
|---|---|
| Runs on Pico/Quest hardware | Opens in Meta Quest / Pico browser — WebXR immersive-ar session |
| Built with WebSpatial | React + `@webspatial/react-sdk` spatial panels |
| Live camera feed | `getUserMedia` renders in Chromium-based headset browsers |
| No install required | Pure browser — zero friction for judges |

### Camera Status by Device
| Device | Live Preview | `capture` input | Notes |
|---|---|---|---|
| Meta Quest | ✅ Works | ✅ Works | Primary target |
| PICO | ✅ Works | ✅ Works | Hackathon target |

## The Four Required Pillars

| Pillar | Implementation |
|---|---|
| **Meta Quest / PICO** | Primary development/testing devices; Chromium-based browsers support full camera + WebXR |
| **Gaussian Splatting** | `teex-car.spz` static asset served from `/assets/`; rendered via SparkRenderer (ImmersiveViewer) and GaussianViewer (desktop Three.js) |
| **WebSpatial** | UI panels built with `@webspatial/react-sdk` |
| **Insurance** | Full end-to-end: OCR document scan → AI damage analysis → AI coverage decisions → claim summary + submit |

## Important Design Decision: Splat Generation

The Gaussian splat (`teex-car.spz`) is a **static demo asset** — actual World Labs API generation is mocked with a 6-second progress animation. World Labs API only accepts 4 images (insufficient for vehicle reconstruction); a real production pipeline would use photogrammetric reconstruction (e.g. InstantSplat on Modal).

---

## Scene State Machine

App.jsx manages a single `scene` string that drives the entire flow:

```
login → scan → splat-view → annotate → review
```

State passed via props (no global state library):

| State key | Type | Set in | Used in |
|---|---|---|---|
| `claim` | `{claimId, adjuster, ocrFields}` | LoginScene | All scenes |
| `damageData` | Damage JSON from `/analyze-damage` | ScanScene | AnnotateScene, ReviewScene |
| `coverageDecisions` | Array from `/check-coverage` | ScanScene | AnnotateScene, ReviewScene |
| `coverageMap` | `{area_name → status}` lookup | ScanScene | AnnotateScene |
| `splatUrl` | `"/api/splat"` | ScanScene | ImmersiveViewer, GaussianViewer |
| `voiceNotes` | `[{id, text, angle, position3d}]` | ScanScene (ImmersiveScan) | AnnotateScene, ImmersiveAnnotate |

---

## User Flow (Detailed)

### Phase 1 — Login (`LoginScene.jsx`)
```
Agent opens LUMEN URL → enters Agent ID + Claim ID
→ Passes {claimId, adjuster} to App state
→ Transitions to 'scan'
```

### Phase 2 — Scan (`ScanScene.jsx`)

Multi-stage wizard:

```
A. TaskCard        — Show assigned claim, tap "Start Inspection"
B. UIQTokenScreen  — Enter UIQ verification token
C. DriverDetails   — Manual entry or document scan (OCR)
D. CapturePhoto    — Take driver photo (optional)
E. DamageScan      — Photo or Immersive capture

  Photo path: CameraCapture → POST /analyze-damage → POST /check-coverage
  Immersive path: ImmersiveScan (WebXR AR)
    ├── Setup: 4-wheel placement via hit-test trigger taps
    ├── Scan: 5 angular buckets (72° each) around car
    ├── Per bucket: capture sharpest frame (pixel variance)
    ├── Trigger: record voice note via Vosk WASM STT
    └── Complete: POST voiceNotes to /api/notes

  Generating stage: POST /analyze-damage + POST /check-coverage (parallel)
    → 6-second fake "World Labs Marble" animation
    → splatUrl = '/api/splat' on completion

F. Coverage modal  — Show coverageDecisions with color-coded cards
   → onComplete() → App.setScene('splat-view')
```

Detection logic in ScanScene:
- WebSpatial shell (`/WebSpatial\//.test(userAgent)`) → CameraCapture (PICO path)
- WebXR AR supported → ImmersiveScan (Quest path)
- Neither → CameraCapture fallback (desktop)

### Phase 3 — Splat View (`ImmersiveViewer.jsx` as scene)

```
ImmersiveViewer launches immersive-ar WebXR session
→ Loads teex-car.spz via SparkRenderer, placed 2m in front
→ Head-locked status panel shows damage area count
→ Trigger pull → session.end() → App.setScene('annotate')
→ Session failure → onExit() → App.setScene('annotate') directly
```

### Phase 4 — Annotate (`AnnotateScene.jsx`)

```
GaussianViewer renders splat as 3D background
Left panel: coverage annotations list (color-coded by status)
Right panel: Field Notes sidebar (voice notes with directional labels)
StickyNote overlays positioned in 3D space
AR toggle: ImmersiveAnnotate if WebXR immersive-ar supported
→ "Continue to Summary" → App.setScene('review')
```

### Phase 5 — Review (`ReviewScene.jsx`)

```
GaussianViewer renders splat as 3D background
Stat cards: Covered / Not Covered / Partial counts
Scrollable coverage decision list (color-coded left border)
Submit button → "Report Submitted ✓" success state
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Meta Quest / PICO / Desktop)                    │
│                                                           │
│  React App (Vite, HTTPS, port 5173)                       │
│  ├── Scenes: Login → Scan → SplatView → Annotate → Review │
│  ├── WebXR immersive-ar (ImmersiveScan, ImmersiveViewer)  │
│  ├── Gaussian Splat (Spark streaming, Three.js canvas)    │
│  ├── Voice Notes (Vosk WASM — offline, on-device STT)     │
│  └── State: App.jsx props chain (no Zustand)              │
│                                                           │
└───────────────────┬──────────────────────────────────────┘
                    │ HTTPS /api/* proxy
         ┌──────────▼──────────────┐
         │  Backend (Express/Node)  │
         │  port 3001               │
         │  ├── /analyze-damage     │
         │  ├── /check-coverage     │
         │  ├── /ocr-document       │
         │  ├── /upload-frames      │
         │  ├── /job-status/:jobId  │
         │  ├── /splat (serves .spz)│
         │  ├── /scan-frame         │
         │  ├── /save-frame         │
         │  ├── /notes              │
         │  └── /log (debug)        │
         │                          │
         │  AI via TAMU Chat API    │
         │  (OpenAI-compatible)     │
         └─────────────────────────┘
```

---

## Commands

### Backend
```bash
cd backend
npm install
node server.js          # runs on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # https://localhost:5173 (HTTPS required)
```

### Three.js peer conflict fix
```bash
cd frontend
npm uninstall three && npm install three@0.180.0 && npm install
```

---

## Environment Variables

Create `backend/.env`:
```
TAMUS_AI_CHAT_API_KEY=...        # required for all AI routes
TAMUS_AI_CHAT_API_ENDPOINT=...   # defaults to https://chat-api.tamu.ai
TAMUS_AI_CHAT_MODEL=...          # defaults to protected.gemini-2.0-flash-lite
PORT=3001
```

The backend uses **TAMU AI Chat** (OpenAI-compatible API), not Anthropic directly. All AI calls go through `backend/lib/tamusChat.js` which provides `createChatCompletion()` with 3-attempt retry, `buildImageMessage()` (data:URI encoding), `extractTextResponse()`, and `parseJsonResponse()` (strips markdown backticks).

---

## File Structure

### Frontend (`frontend/src/`)

#### Scenes
| File | Description |
|---|---|
| `scenes/LoginScene.jsx` | Login form; sets claim state and transitions to scan |
| `scenes/ScanScene.jsx` | Multi-stage scan wizard: task → UIQ token → driver details → damage capture → coverage modal |
| `scenes/AnnotateScene.jsx` | Splat background + coverage annotation panel + voice notes sidebar + StickyNote overlays |
| `scenes/ReviewScene.jsx` | Claim summary with stat cards, coverage list, submit button |

#### Components
| File | Description |
|---|---|
| `components/ImmersiveScan.jsx` | Full WebXR AR scan experience: wheel placement → 5-bucket ring scan → Vosk voice notes |
| `components/ImmersiveViewer.jsx` | WebXR AR splat viewer: SparkRenderer loads .spz, head-locked status panel, trigger to exit |
| `components/ImmersiveAnnotate.jsx` | WebXR AR annotation review: coverage panel (left), voice notes panel (right), world-anchored stickies |
| `components/GaussianViewer.jsx` | Desktop Three.js canvas viewer for .spz Gaussian splat (background use) |
| `components/StickyNote.jsx` | Positioned coverage annotation card with color, area name, policy section |
| `components/CameraCapture.jsx` | Camera capture with live preview, upload fallback, canvas frame extraction |
| `components/CameraBackground.jsx` | Fixed full-screen camera video feed background |
| `components/AppBackground.jsx` | Full-screen camera background for login/scan scenes |
| `components/ClaimHUD.jsx` | Head-locked status bar showing claim ID, adjuster, stage, progress |
| `components/SideNav.jsx` | Fixed left sidebar with navigation icons |
| `components/PolicyCitation.jsx` | Compact policy section reference card (section, reason, estimated payout) |

#### Utilities
| File | Description |
|---|---|
| `lib/api.js` | Fetch wrappers: `ocrDocument()`, `analyzeDamage()`, `checkCoverage()`, `uploadFrames()`, `pollJobStatus()`, `scanFrame()`, `imageToBase64()` |
| `lib/coverageColors.js` | Maps `coverage_status` strings (`green/red/amber/gray`) to hex colors, labels, opacity |
| `lib/enableXRLayer.js` | Returns CSS custom properties for WebSpatial AR layer positioning |

### Backend (`backend/`)

#### Routes
| File | Endpoint | Description |
|---|---|---|
| `routes/analyzeDamage.js` | `POST /analyze-damage` | Vision analysis → `{damage_type, severity, affected_areas[], fraud_flags[], safety_flags[], confidence}` |
| `routes/checkCoverage.js` | `POST /check-coverage` | Coverage decisions per area → `[{area_name, coverage_status, policy_section, reason, color, estimated_payout_usd}]` |
| `routes/ocrDocument.js` | `POST /ocr-document` | Document field extraction → `{document_type, extracted_fields{}, confidence}` |
| `routes/uploadFrames.js` | `POST /upload-frames` | Accepts frames array, returns mock `{jobId}` |
| `routes/jobStatus.js` | `GET /job-status/:jobId` | Returns mock `{status: 'completed', progress: 100, splatUrl}` |
| `routes/serveSplat.js` | `GET /splat` | Streams `backend/assets/car_burnout_converted.spz` |
| `routes/scanFrame.js` | `POST /scan-frame` | Analyze single frame + save to debug-images; supports per-bucket angle tracking |
| `routes/saveFrame.js` | `POST /save-frame` | Archive individual frame to `backend/scan-frames/{scanId}/` |
| `routes/saveNotes.js` | `POST /notes`, `GET /notes/:scanId` | Store/retrieve voice notes JSON |

`server.js` also provides `GET /health` and `POST /log` (frontend debug logging to terminal).

#### Prompts (`backend/prompts/`)
All prompts instruct the model to return **only valid JSON** with no markdown. `parseJsonResponse()` strips any accidental code fences.

| File | Purpose |
|---|---|
| `damagePrompt.js` | Damage analysis schema: affected_areas, fraud_flags, safety_flags, severity, cost estimates |
| `coveragePrompt.js` | Coverage logic: maps damage → policy → `coverage_status` (covered/excluded/partial/requires_review), color codes |
| `ocrPrompt.js` | Document extraction: name, DOB, license_number, policy_number, vehicle details, address |

---

## Key Data Structures

### Coverage Decision (from `/check-coverage`)
```javascript
{
  area_name: "rear bumper",
  coverage_status: "covered" | "excluded" | "partial" | "requires_review",
  confidence: "high" | "medium" | "low",
  requires_human_review: boolean,
  policy_section: "3.2a",
  reason: "one-line explanation",
  color: "green" | "red" | "amber" | "gray",
  estimated_payout_usd: { min: number, max: number }
}
```

### Voice Note (from ImmersiveScan)
```javascript
{
  id: "1234567890",
  text: "transcribed text from Vosk",
  angle: 45.0,              // azimuth degrees (0-360)
  position3d: { x, y, z }, // 3D world-space position
  timestamp: "4/27/2026 2:30 PM",
  audioUrl: "blob:https://..."
}
```

---

## Required Assets (not in repo)

Place in `frontend/public/assets/`:
- `teex-car.spz` — Gaussian splat for immersive/desktop view

Place in `backend/assets/`:
- `car_burnout_converted.spz` — served by `GET /splat` endpoint

Place in `frontend/public/assets/`:
- `vosk-model-small-en-us-0.15.tar.gz` — Vosk offline STT model (~40MB)

**Vosk model setup:**
```powershell
cd frontend/public/assets
Invoke-WebRequest https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -OutFile model.zip
Expand-Archive model.zip .
cd vosk-model-small-en-us-0.15
tar -czf ..\vosk-model-small-en-us-0.15.tar.gz .
cd ..
Remove-Item model.zip
Remove-Item vosk-model-small-en-us-0.15 -Recurse
```
The model is cached in IndexedDB after first load. If you get "does not contain model files", clear IndexedDB for the origin (DevTools → Application → IndexedDB) or use incognito.

---

## Key Constraints

- Vite runs with HTTPS (`@vitejs/plugin-basic-ssl`) — required for `getUserMedia` and WebXR. All API calls go through Vite proxy (`/api/*` → `http://localhost:3001`) to avoid mixed-content blocks.
- For network testing (Meta Quest / PICO), use the **Network URL** (`https://192.168.x.x:5173`), not localhost.
- Meta Quest Browser requires accepting the self-signed cert — tap "Advanced" → "Proceed".
- Camera permission must be granted in Meta Quest settings.
- WebXR `immersive-ar` passthrough works on real Meta Quest 3 and PICO 4. Does NOT work on PICO emulator — expected.
- WebSpatial `volume` scene works on real PICO with native WebSpatial shell and on PICO emulator. Falls back to flat 2D on Meta Quest browser.
- **Vosk WASM requires `SharedArrayBuffer`** — Vite headers set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`. If WebXR fails to launch on Quest, these headers may be the cause.
- **`/vosk-test.html`** — standalone STT test page at `frontend/public/vosk-test.html` for desktop testing without WebXR.
- **`rlog(msg, data)`** helper in ImmersiveScan — POSTs debug messages to `/api/log` → prints to backend terminal. Use for Quest debugging where DevTools is unavailable.

## Coverage Color System

`coverage_decisions[].color` values (`green`, `red`, `amber`, `gray`) from TAMU AI map directly to `coverageColors.js` → used for border colors in annotation panels and sticky note styling.
