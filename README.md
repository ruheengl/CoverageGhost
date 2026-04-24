# Coverage Ghost

AI-powered spatial insurance companion — XRCC 2026, PICO / WebSpatial track.

---

## Prerequisites

- Node.js 20+ — [nodejs.org](https://nodejs.org) (LTS)
- Git
- Anthropic API key — [api.anthropic.com](https://api.anthropic.com)
- Android Studio + PICO Emulator (for PICO testing)

---

## Setup

### 1. Clone

```bash
git clone https://github.com/ruheengl/CoverageGhost.git
cd coverageghost
```

### 2. Frontend

```bash
cd frontend
npm install
```

If you get a Three.js peer dependency conflict:

```bash
npm uninstall three
npm install three@0.180.0
npm install
```

### 3. Backend

```bash
cd ../backend
npm install
```

### 4. Environment variables

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
VID2SCENE_API_KEY=your-key-here
LUMA_API_KEY=your-key-here
PORT=3001
```

### 5. Add asset files

Place Teex scan files in `frontend/public/assets/` — get these from the shared team drive:

```
frontend/public/assets/teex-car.glb
frontend/public/assets/teex-car.spz
```

---

## Running

Start both servers in separate terminals.

**Backend:**
```bash
cd backend
node server.js
# Backend on port 3001
```

**Frontend:**
```bash
cd frontend
npm run dev
# Local:   http://localhost:5173
# Network: http://192.168.x.x:5173
```

Open `http://localhost:5173` in a browser to confirm it loads.

---

## Testing on Apple Vision Pro

Vision Pro and your machine must be on the same WiFi network.

**1. Find your local IP:**

Windows:
```cmd
ipconfig
# Look for IPv4 Address under WiFi adapter
```

Mac:
```bash
ipconfig getifaddr en0
```

**2. Open Safari on Vision Pro and navigate to:**

```
http://YOUR_IP:5173
```

That's it. No packaging or Xcode needed. WebSpatial spatial features work directly in Vision Pro's browser.

> If Vision Pro can't connect — allow port 5173 through Windows Firewall:
> Windows Security → Firewall → Advanced settings → Inbound Rules → New Rule → Port → TCP → 5173 → Allow

---

## Testing on PICO Emulator (Windows)

### One-time setup

1. Install Android Studio — [developer.android.com/studio](https://developer.android.com/studio)
2. Follow the PICO Emulator setup guide: `developer.picoxr.com/document/unity-swan/pico-emulator/`
3. Watch the setup video first (10 min): `youtube.com/playlist?list=PLRQI9ZSqDkKdqhIYyEMu3f1g3SyzpfZn4`

### Running

1. Start the frontend dev server (`npm run dev`)
2. Launch the PICO Emulator from Android Studio
3. Open the browser inside the emulator
4. Navigate to your **Network URL** (not localhost): `http://192.168.x.x:5173`

> If the emulator can't connect — same fix as above, allow port 5173 in Windows Firewall.

---

## Note on webspatial-builder

`webspatial-builder run` requires macOS + Xcode and **will not work on Windows**. For development, use the browser testing method above. The builder is only needed for App Store submission on a Mac.

---

## Common Issues

| Error | Fix |
|---|---|
| `Cannot resolve '@webspatial/builder/vite'` | Remove the import from `vite.config.js` — no WebSpatial Vite plugin needed |
| `'xcodebuild' is not recognized` | Can't run `webspatial-builder` on Windows — use browser testing instead |
| Three.js peer conflict | `npm uninstall three && npm install three@0.180.0` |
| Emulator/Vision Pro can't connect | Allow port 5173 in Windows Firewall inbound rules |
| All Coverage Ghost wireframes gray | GLB mesh names don't match Claude output — check names at `gltf.report` |