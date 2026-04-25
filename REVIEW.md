# CoverageGhost — Issue Review Log

Running log of bugs found, root causes, and fixes applied.

---

## Session: April 25, 2026

---

### [BUG-01] Frontend blank screen after fetching teammate's changes

**Symptom:** App shows nothing after `git merge`. Build error: `"default" is not exported by "src/scenes/ScanScene.jsx"`.

**Root cause:** The merge combined the teammate's new pre-scan UI sub-components (`TaskCard`, `UIQTokenScreen`, `DriverDetailsChoice`, `ScanLicenseScreen`, `DriverDetailsResult`, `CapturePhotoScreen`) with our `DamageScanScreen`, but the `export default function ScanScene` wrapper that orchestrates all of them was lost in the merge conflict resolution.

**Fix:** Added `export default function ScanScene` at the end of `ScanScene.jsx` with a `step` state machine (`task → uiq → driver-choice → license → driver → photo → scan`) that renders each sub-screen in sequence and eventually mounts `DamageScanScreen`.

---

### [BUG-02] White screen after verifying UIQ token

**Symptom:** Clicking "Verify" on `UIQTokenScreen` shows a blank white screen.

**Root cause:** The `ScanScene` wrapper (added in BUG-01 fix) referenced `<LicenseCaptureScreen>` which does not exist. The teammate named it `ScanLicenseScreen`, and also added `DriverDetailsChoice` as an intermediate screen before the license scan — that step was missing from the flow entirely.

**Fix:** Corrected component name from `LicenseCaptureScreen` → `ScanLicenseScreen` and inserted the missing `driver-choice` step between `uiq` and `license`.

**Correct flow:** `task → uiq → driver-choice → license → driver → photo → scan`

---

### [BUG-03] `analyzeDamage` ECONNRESET failures

**Symptom:**
```
analyzeDamage error: TypeError: fetch failed
  cause: Error: read ECONNRESET
```

**Root cause:** `tamusChat.js` made a single `fetch` call to the TAMU AI API with no retry logic. ECONNRESET (TCP connection reset mid-request) from the remote server caused an immediate hard failure.

**Fix:** Wrapped `createChatCompletion` in a retry loop (3 attempts). Retries only on `ECONNRESET` or `ECONNREFUSED` with exponential backoff (800ms, 1600ms). Other errors (4xx, bad JSON) throw immediately.

**File:** `backend/lib/tamusChat.js`

---

### [BUG-04] Scan frames saved to wrong directory

**Symptom:** Frames were being saved to `backend/scan-frames/` instead of `backend/debug-images/`.

**Root cause:** `backend/routes/saveFrame.js` hardcoded `../scan-frames` as the save directory.

**Fix:** New combined route `backend/routes/scanFrame.js` saves to `backend/debug-images/scan-{scanId}/frame-{bucketIndex}-{angle}deg.jpg`.

---

### [BUG-05] Two separate API calls for frame upload and damage analysis

**Symptom / Design issue:** Frontend was calling `/save-frame` and `/analyze-damage` as two independent requests per bucket update. The save did not need to be real-time but the analysis did, causing unnecessary latency coupling.

**Fix:** New combined backend route `POST /scan-frame`:
- Saves image to `backend/debug-images/` via `setImmediate` (fire-and-forget, does not block response)
- Runs `analyzeDamage` with `damagePrompt` and returns result immediately
- Frontend calls one endpoint; image is saved in the background after the AI response is sent

**Files:** `backend/routes/scanFrame.js`, `frontend/src/lib/api.js` (`scanFrame` function), `frontend/src/components/ImmersiveScan.jsx` (`uploadAndAnalyze`)

---

### [BUG-06] Controller rays rendered at floor level (Y≈0) instead of controller height

**Symptom:** Controller ray lines appeared flat on the ground rather than at hand/controller height during the immersive scan.

**Root cause:** Coordinate frame mismatch between Three.js's internal XR camera and the `refSpace` used for `frame.getPose()` calls. Three.js defaults to `local-floor` reference space internally, but `refSpace` was obtained via `session.requestReferenceSpace('unbounded')`. The two reference spaces have different world origins, so controller poses computed in `unbounded` space rendered in the wrong position relative to Three.js's `local-floor` camera.

**Fix:**
1. Call `renderer.xr.setReferenceSpaceType('local-floor')` before `renderer.xr.setSession()` to explicitly anchor Three.js
2. After session setup, try to upgrade to `unbounded` via `renderer.xr.setReferenceSpace(unbounded)` (tells Three.js to use it)
3. Always derive `refSpace` from `renderer.xr.getReferenceSpace()` — guaranteed to match Three.js's internal camera

**File:** `frontend/src/components/ImmersiveScan.jsx`

---

### [BUG-07] 3D scan ring rendered as flat arcs on the floor (invisible from standing height)

**Symptom:** The progress ring around the car was a flat set of arc-shaped boxes lying on the floor (y=0.025), effectively invisible when standing.

**Root cause:** `createScanRing` used `BoxGeometry(arcLen, 0.05, 0.05)` with the long axis tangent to the circle and only 5cm tall — a flat ground marking rather than a visible 3D indicator.

**Fix:** Changed to vertical pillar geometry `BoxGeometry(0.06, 0.5, 0.06)` centered at y=0.25 (base at floor, top at 0.5m). 18 posts form a visible ring of glowing columns around the car at knee/waist height. Rotation removed since vertical orientation needs no tangent alignment.

**File:** `frontend/src/components/ImmersiveScan.jsx`, `createScanRing()`

---

## Known Limitations / Not Yet Fixed

| Item | Notes |
|---|---|
| WebXR `immersive-ar` not available on PICO emulator | Expected — emulator has no real cameras. Works on real PICO 4 and Meta Quest 3. |
| Voice notes require microphone permission | Must be granted in headset browser settings before entering scan. |
| `analyzeDamage` field names (`affected_areas[].name`) differ from `checkCoverage` field names (`coverage_decisions[].area_name`) | Frontend `drawDamage` handles both via fallback chain. No backend change needed. |
| Large JS bundle warning (>500KB) | Caused by Three.js + Spark. Acceptable for hackathon; fix with dynamic imports for production. |
