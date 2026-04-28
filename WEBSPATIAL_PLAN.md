# Plan: Purposeful WebSpatial Spatial Effects

## Context

The `@webspatial/react-sdk` is installed and only `SSRProvider` is used. PICO's judges developed WebSpatial, so meaningful use of its CSS spatial properties and interaction events will impress them. Features must serve the real insurance agent workflow — not decoration.

Key WebSpatial APIs available (from docs at webspatial.dev/docs):
- **`--xr-back`** CSS custom property: lifts elements along Z-axis. Requires `position: relative|absolute|fixed`.
- **`--xr-background-material: translucent`**: native glass/translucent material rendered by the spatial shell (ignored on non-spatial browsers).
- **Spatial events** on any HTML element: `onSpatialDragStart`, `onSpatialDrag`, `onSpatialDragEnd`, `onSpatialMagnify`, `onSpatialMagnifyEnd`. Events don't fire on non-spatial platforms — safe to add unconditionally (graceful no-op).
- **Auto hover depth**: Runtime automatically renders depth feedback on elements with `cursor: pointer`. No extra code needed.

All CSS custom properties and spatial events degrade gracefully — they are no-ops on Meta Quest browser.

---

## Change 1 — Login Card: Depth + Draggable (`LoginScene.jsx`)

The agent opens the app while wearing the headset. Making the login card draggable in 3D space is genuinely useful — they can reposition it without blocking their view of the room.

**CSS additions to card `<div>` (already has `position: relative`):**
```jsx
style={{
  ...existing styles,
  ['--xr-back']: '60px',
  ['--xr-background-material']: 'translucent',
}}
```

**Drag handling** — use `useState` for offset + `useRef` for start position:
```jsx
const [cardOffset, setCardOffset] = useState({ x: 0, y: 0 });
const dragStart = useRef({ x: 0, y: 0 });

// On card div:
onSpatialDragStart={() => { dragStart.current = { ...cardOffset }; }}
onSpatialDrag={(e) => setCardOffset({
  x: dragStart.current.x + e.translationX,
  y: dragStart.current.y + e.translationY,
})}
// Apply as:
style={{ ...existing, transform: `translate(${cardOffset.x}px, ${cardOffset.y}px)`, ['--xr-back']: '60px', ['--xr-background-material']: 'translucent' }}
```

**Login button** — add `cursor: 'pointer'` + `position: 'relative'` + `['--xr-back']: '15px'`. PICO runtime auto-applies hover depth feedback. Also add CSS hover class for Meta Quest fallback.

---

## Change 2 — Claim Summary: Pinch to Zoom (`ReviewScene.jsx`)

Coverage decisions contain text-heavy policy reasons. `onSpatialMagnify` lets the agent pinch-zoom the claim summary card to read fine print — directly useful.

```jsx
const [scale, setScale] = useState(1);
const scaleBase = useRef(1);
const scaleRef = useRef(1);

// On summary card div:
style={{
  ...existing,
  position: 'relative',
  transform: `scale(${scale})`,
  transformOrigin: 'top left',
  ['--xr-back']: '30px',
  ['--xr-background-material']: 'translucent',
}}
onSpatialMagnify={(e) => {
  const next = Math.max(0.5, Math.min(3, scaleBase.current * e.magnification));
  scaleRef.current = next;
  setScale(next);
}}
onSpatialMagnifyEnd={() => { scaleBase.current = scaleRef.current; }}
```

---

## Change 3 — Global Button Hover CSS (`index.css`)

Meta Quest fallback: CSS spring hover animation for all interactive buttons.

```css
.spatial-btn {
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.18s ease;
  cursor: pointer;
}
.spatial-btn:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 10px 32px rgba(13, 148, 136, 0.45);
}
.spatial-btn:active {
  transform: translateY(1px) scale(0.97);
}
```

Apply `className="spatial-btn"` to: Login button, Forgot Password button (LoginScene).

---

## Critical Files

| File | Change |
|---|---|
| `frontend/src/scenes/LoginScene.jsx` | `--xr-back`, `--xr-background-material`, `onSpatialDrag` on card; `--xr-back` + `spatial-btn` on buttons |
| `frontend/src/scenes/ReviewScene.jsx` | `--xr-back`, `--xr-background-material`, `onSpatialMagnify` on claim summary card |
| `frontend/src/index.css` | Add `.spatial-btn` class |

No new components or dependencies needed. AnnotateScene excluded — will be refactored.

---

## Verification

1. **Desktop browser**: buttons show spring hover animation. No console errors. Claim summary doesn't scale unexpectedly.
2. **Meta Quest browser**: same as desktop (spatial events never fire). Hover CSS animation visible.
3. **PICO emulator / device with WebSpatial shell**:
   - Login card appears lifted off the plane with translucent glass effect
   - Agent can pinch-drag the login card to reposition it in space
   - Claim summary can be pinch-zoomed to read coverage detail text
   - Buttons show native depth feedback when looked at (auto-hover from `cursor: pointer` + `--xr-back`)
