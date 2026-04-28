import { useEffect } from 'react';
import * as THREE from 'three';

const DIR_LABELS = ['Front', 'Front-Right', 'Right', 'Rear-Right', 'Rear', 'Rear-Left', 'Left', 'Front-Left'];
const STATUS_HEX = { green: '#4ade80', red: '#f87171', amber: '#fbbf24', gray: '#94a3b8' };

// XR palette — dark charcoal, Apple-style
const XR_BG    = 'rgba(22,24,30,0.92)';
const XR_BORDER = 'rgba(255,255,255,0.1)';

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function makeCanvasPlane(w, h, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(512 * (h / w));
  drawFn(canvas.getContext('2d'), canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  return mesh;
}

export default function ImmersiveAnnotate({ coverageDecisions = [], voiceNotes = [], onComplete, onExit }) {
  useEffect(() => {
    let session = null;

    async function start() {
      if (!navigator.xr) { onExit(); return; }
      try {
        session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['unbounded'],
        });
      } catch (e) {
        console.warn('[ImmersiveAnnotate] session failed:', e.message);
        onExit();
        return;
      }

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;';

      const refSpace = renderer.xr.getReferenceSpace();
      const scene = new THREE.Scene();
      const xrCam = new THREE.PerspectiveCamera();

      // ── Coverage panel (left) ──────────────────────────────────────────────
      const COV_H = 0.08 + coverageDecisions.length * 0.075 + 0.06;
      const covPanel = makeCanvasPlane(0.46, Math.max(COV_H, 0.22), (ctx, W, H) => {
        ctx.fillStyle = XR_BG;
        rrect(ctx, 0, 0, W, H, 22); ctx.fill();
        ctx.strokeStyle = XR_BORDER; ctx.lineWidth = 2;
        rrect(ctx, 0, 0, W, H, 22); ctx.stroke();

        ctx.fillStyle = 'white'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Coverage Review', 22, 44);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '13px Arial';
        ctx.fillText(`${coverageDecisions.length} area${coverageDecisions.length !== 1 ? 's' : ''}`, 22, 66);

        const rowPx = H / Math.max(coverageDecisions.length + 1.8, 3);
        coverageDecisions.forEach((d, i) => {
          const y = 76 + i * rowPx;
          const color = STATUS_HEX[d.coverage_status] || '#94a3b8';
          ctx.fillStyle = color;
          rrect(ctx, 14, y + 2, 4, rowPx - 8, 3); ctx.fill();
          ctx.fillStyle = 'white'; ctx.font = 'bold 16px Arial';
          ctx.fillText(d.area_name || `Area ${i + 1}`, 28, y + 20);
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '12px Arial';
          const r = (d.reason || '').slice(0, 60) + ((d.reason || '').length > 60 ? '…' : '');
          ctx.fillText(r, 28, y + 38);
        });

        if (!coverageDecisions.length) {
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '15px Arial'; ctx.textAlign = 'center';
          ctx.fillText('No coverage data', W / 2, H / 2);
        }
      });
      scene.add(covPanel);

      // ── Voice notes panel (right) — only if notes exist ───────────────────
      let notesPanel = null;
      if (voiceNotes.length > 0) {
        const NOTE_ROW = 0.072;
        const NOTES_H = 0.08 + voiceNotes.length * NOTE_ROW + 0.02;
        notesPanel = makeCanvasPlane(0.36, Math.max(NOTES_H, 0.18), (ctx, W, H) => {
          ctx.fillStyle = XR_BG;
          rrect(ctx, 0, 0, W, H, 22); ctx.fill();
          ctx.strokeStyle = XR_BORDER; ctx.lineWidth = 2;
          rrect(ctx, 0, 0, W, H, 22); ctx.stroke();

          ctx.fillStyle = 'white'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'left';
          ctx.fillText('Field Notes', 20, 40);
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = 'bold 14px Arial';
          ctx.fillText(`${voiceNotes.length}`, W - 36, 40);

          const rowPx = (H - 52) / Math.max(voiceNotes.length, 1);
          voiceNotes.forEach((note, i) => {
            const y = 52 + i * rowPx;
            ctx.fillStyle = 'rgba(79,156,249,0.1)';
            rrect(ctx, 10, y + 2, W - 20, rowPx - 6, 8); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 12px Arial';
            ctx.fillText(DIR_LABELS[Math.round(note.angle / 45) % 8], 18, y + 18);
            ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12px Arial';
            const t = (note.text || '(no transcript)').slice(0, 42) + ((note.text || '').length > 42 ? '…' : '');
            ctx.fillText(t, 18, y + 34);
          });
        });
        scene.add(notesPanel);
      }

      // ── Toolbar (right edge) ───────────────────────────────────────────────
      const toolbarPanel = makeCanvasPlane(0.062, 0.22, (ctx, W, H) => {
        ctx.fillStyle = 'rgba(22,24,30,0.92)';
        rrect(ctx, 0, 0, W, H, 20); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5;
        rrect(ctx, 0, 0, W, H, 20); ctx.stroke();
        const icons = ['📋', '🎙', '✓'];
        const iconY = [H * 0.22, H * 0.5, H * 0.78];
        icons.forEach((icon, i) => {
          ctx.font = '22px Arial'; ctx.textAlign = 'center';
          ctx.fillText(icon, W / 2, iconY[i]);
        });
      });
      scene.add(toolbarPanel);

      // ── Continue hint (bottom center) ─────────────────────────────────────
      const hintPanel = makeCanvasPlane(0.38, 0.055, (ctx, W, H) => {
        ctx.fillStyle = XR_BG;
        rrect(ctx, 0, 0, W, H, 16); ctx.fill();
        ctx.strokeStyle = XR_BORDER; ctx.lineWidth = 1.5;
        rrect(ctx, 0, 0, W, H, 16); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '18px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Pull trigger to continue to summary', W / 2, H / 2 + 7);
      });
      scene.add(hintPanel);

      // ── Frame loop ────────────────────────────────────────────────────────
      session.requestAnimationFrame(function loop(time, frame) {
        session.requestAnimationFrame(loop);
        const vp = frame.getViewerPose(refSpace);
        if (!vp) { renderer.render(scene, xrCam); return; }

        const { x: tx, y: ty, z: tz } = vp.transform.position;
        const q = vp.transform.orientation;
        const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        const fwd   = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
        const left  = new THREE.Vector3(-1, 0, 0).applyQuaternion(quat);

        const D = 0.9;

        // Coverage panel — left
        covPanel.position.set(tx + fwd.x*D + left.x*0.26, ty + fwd.y*D, tz + fwd.z*D + left.z*0.26);
        covPanel.quaternion.copy(quat);

        // Notes panel — right (only if present)
        if (notesPanel) {
          notesPanel.position.set(tx + fwd.x*D + right.x*0.24, ty + fwd.y*D, tz + fwd.z*D + right.z*0.24);
          notesPanel.quaternion.copy(quat);
        }

        // Toolbar — far right
        toolbarPanel.position.set(tx + fwd.x*D + right.x*0.44, ty + fwd.y*D, tz + fwd.z*D + right.z*0.44);
        toolbarPanel.quaternion.copy(quat);

        // Hint — bottom center
        hintPanel.position.set(tx + fwd.x*D, ty - 0.25 + fwd.y*D, tz + fwd.z*D);
        hintPanel.quaternion.copy(quat);

        renderer.render(scene, xrCam);
      });

      // Trigger = proceed to summary
      session.addEventListener('selectend', () => {
        session.end().catch(() => {});
        onComplete();
      });

      session.addEventListener('end', () => {
        renderer.dispose();
        renderer.domElement.remove();
        onExit();
      });
    }

    start();
    return () => { if (session) session.end().catch(() => {}); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
