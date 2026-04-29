# Lumen — Frontend Runbook

## Prerequisites

- Node.js 18+
- Xcode with visionOS simulator components installed
- Apple Developer account signed in to Xcode (Settings → Accounts)
- Backend server running on port 3001 (see `backend/`)

---

## Running on Desktop / Browser

```bash
cd frontend
npm install
npm run dev
```

Opens at `https://localhost:5173`. Accept the self-signed cert warning on first visit.

---

## Running on visionOS Simulator

**Terminal 1 — start the dev server:**
```bash
npm run dev
```

**Terminal 2 — launch simulator:**
```bash
npm run spatial
```

The builder packages the app and installs it in the visionOS simulator automatically.

---

## Running on Physical Apple Vision Pro

### One-time setup
1. Connect Vision Pro to Mac via USB-C or pair wirelessly (Xcode → Window → Devices and Simulators)
2. In Xcode → Settings → Accounts: sign in with your Apple Developer account
3. Find your Mac's local IP:
   ```bash
   ipconfig getifaddr en0
   ```
4. Update the `--base` URL in `package.json` to match your IP:
   ```json
   "spatial:device": "webspatial-builder build ... --base=\"https://YOUR_IP:5173/\" ..."
   ```

### Every session

**Terminal 1 — start the dev server (must stay running):**
```bash
npm run dev
```

**Terminal 2 — build and generate the Xcode project:**
```bash
npm run spatial:device
```

**Then in Xcode:**
- Open the generated project:
  ```
  ! open /Users/rathod-dhruv/Downloads/CoverageGhost/frontend/node_modules/.webspatial-builder-temp/platform-visionos/project/web-spatial.xcodeproj
  ```
- Select your Vision Pro as the run destination
- Press **⌘R** to build and install on device

> The Xcode project is regenerated each time `npm run spatial:device` runs.
> Any manual changes to Swift files (e.g. debug patches) will be overwritten.

### If your IP changes (DHCP)
```bash
ipconfig getifaddr en0   # get new IP
```
Update `--base` in `package.json`, run `npm run spatial:device` again, then ⌘R in Xcode.

---

## Changing the Web URL

The WebSpatial native shell loads whatever URL is set in `--base`. To change it, edit `package.json`:

```json
"spatial:device": "webspatial-builder build --manifest=public/app.webmanifest --bundle-id=com.webspatial.lumen --teamId=6FD7NQC7ZL --base=\"https://NEW_URL/\" --buildType=device"
```

Then run `npm run spatial:device` and rebuild in Xcode (⌘R).

---

## Debugging on Device

The WKWebView is inspectable. With the app running on Vision Pro:

1. Open **Safari** on your Mac
2. Enable Develop menu: Safari → Settings → Advanced → Show features for web developers
3. Develop → [Vision Pro name] → Coverage Ghost → [page]
4. Use the **Console** tab to see JS errors

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server at `https://localhost:5173` |
| `npm run build` | Production build |
| `npm run spatial` | Run on visionOS simulator |
| `npm run spatial:device` | Build Xcode project for physical Vision Pro |
