import { useEffect } from 'react';
import * as THREE from 'three';

const DIR_LABELS = ['Front', 'Front-Right', 'Right', 'Rear-Right', 'Rear', 'Rear-Left', 'Left', 'Front-Left'];
const STATUS_HEX = { green: '#34d399', red: '#f87171', amber: '#fbbf24', gray: '#94a3b8' };

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
      const ROW_H = 58;
      const COV_H = 0.08 + coverageDecisions.length * 0.075 + 0.06;
      const covPanel = makeCanvasPlane(0.48, Math.max(COV_H, 0.22), (ctx, W, H) => {
        ctx.fillStyle = 'rgba(15,23,42,0.65)';
        rrect(ctx, 0, 0, W, H, 24); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        rrect(ctx, 0, 0, W, H, 24); ctx.stroke();

        ctx.fillStyle = 'white'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Coverage Review', 24, 46);

        const rowPx = H / Math.max(coverageDecisions.length + 1.5, 3);
        coverageDecisions.forEach((d, i) => {
          const y = 64 + i * rowPx;
          const color = STATUS_HEX[d.coverage_status] || '#94a3b8';
          ctx.fillStyle = color;
          rrect(ctx, 14, y + 4, 5, rowPx - 12, 3); ctx.fill();
          ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial';
          ctx.fillText(d.area_name || `Area ${i + 1}`, 30, y + 22);
          ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '13px Arial';
          const r = (d.reason || '').slice(0, 58) + ((d.reason || '').length > 58 ? '…' : '');
          ctx.fillText(r, 30, y + 42);
        });

        if (!coverageDecisions.length) {
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '16px Arial'; ctx.textAlign = 'center';
          ctx.fillText('No coverage data', W / 2, H / 2);
        }
      });
      scene.add(covPanel);

      // ── Voice notes panel (right) ──────────────────────────────────────────
      const NOTE_ROW = 0.072;
      const NOTES_H = 0.08 + voiceNotes.length * NOTE_ROW + 0.02;
      const notesPanel = makeCanvasPlane(0.38, Math.max(NOTES_H, 0.18), (ctx, W, H) => {
        ctx.fillStyle = 'rgba(15,23,42,0.65)';
        rrect(ctx, 0, 0, W, H, 24); ctx.fill();
        ctx.strokeStyle = 'rgba(251,191,36,0.3)';
        ctx.lineWidth = 2;
        rrect(ctx, 0, 0, W, H, 24); ctx.stroke();

        ctx.fillStyle = 'white'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'left';
        ctx.fillText('Field Notes', 22, 42);
        if (voiceNotes.length) {
          ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 15px Arial';
          ctx.fillText(`${voiceNotes.length}`, W - 40, 42);
        }

        const rowPx = (H - 56) / Math.max(voiceNotes.length, 1);
        voiceNotes.forEach((note, i) => {
          const y = 56 + i * rowPx;
          ctx.fillStyle = 'rgba(251,191,36,0.12)';
          rrect(ctx, 10, y + 2, W - 20, rowPx - 6, 10); ctx.fill();
          ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 13px Arial';
          ctx.fillText(DIR_LABELS[Math.round(note.angle / 45) % 8], 20, y + 20);
          ctx.fillStyle = 'white'; ctx.font = '13px Arial';
          const t = (note.text || '(no transcript)').slice(0, 42) + ((note.text || '').length > 42 ? '…' : '');
          ctx.fillText(t, 20, y + 38);
        });

        if (!voiceNotes.length) {
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '15px Arial'; ctx.textAlign = 'center';
          ctx.fillText('No voice notes recorded', W / 2, H / 2);
        }
      });
      scene.add(notesPanel);

      // ── World-anchored sticky notes at position3d ─────────────────────────
      const stickyMeshes = voiceNotes
        .filter(n => n.position3d)
        .map(note => {
          const mesh = makeCanvasPlane(0.2, 0.13, (ctx, W, H) => {
            ctx.fillStyle = '#fef08a';
            rrect(ctx, 0, 0, W, H, 16); ctx.fill();
            ctx.fillStyle = '#ca8a04'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
            ctx.fillText(DIR_LABELS[Math.round(note.angle / 45) % 8], W / 2, 28);
            ctx.fillStyle = '#1c1917'; ctx.font = '15px Arial'; ctx.textAlign = 'left';
            const words = (note.text || '(no transcript)').split(' ');
            let line = '', y = 52;
            for (const w of words) {
              const test = line + w + ' ';
              if (ctx.measureText(test).width > W - 32 && line) { ctx.fillText(line.trim(), 16, y); line = w + ' '; y += 20; }
              else line = test;
            }
            if (line) ctx.fillText(line.trim(), 16, y);
          });
          mesh.position.set(note.position3d.x, note.position3d.y + 0.18, note.position3d.z);
          scene.add(mesh);
          return mesh;
        });

      // ── Continue button ────────────────────────────────────────────────────
      const continueBtn = makeCanvasPlane(0.3, 0.062, (ctx, W, H) => {
        ctx.fillStyle = '#0d9488';
        rrect(ctx, 0, 0, W, H, 20); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
        ctx.fillText('Continue to Review  →', W / 2, H / 2 + 10);
      });
      scene.add(continueBtn);

      // ── Exit button ────────────────────────────────────────────────────────
      const exitBtn = makeCanvasPlane(0.13, 0.048, (ctx, W, H) => {
        ctx.fillStyle = 'rgba(239,68,68,0.85)';
        rrect(ctx, 0, 0, W, H, 16); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center';
        ctx.fillText('✕  Exit', W / 2, H / 2 + 9);
      });
      scene.add(exitBtn);

      // ── Frame loop ────────────────────────────────────────────────────────
      let lastPoses = [];

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
        covPanel.position.set(tx + fwd.x*D + left.x*0.28, ty + fwd.y*D, tz + fwd.z*D + left.z*0.28);
        covPanel.quaternion.copy(quat);

        notesPanel.position.set(tx + fwd.x*D + right.x*0.26, ty + fwd.y*D, tz + fwd.z*D + right.z*0.26);
        notesPanel.quaternion.copy(quat);

        continueBtn.position.set(tx + fwd.x*D, ty - 0.24 + fwd.y*D, tz + fwd.z*D);
        continueBtn.quaternion.copy(quat);

        exitBtn.position.set(tx + fwd.x*D + right.x*0.24, ty + 0.22 + fwd.y*D, tz + fwd.z*D + right.z*0.24);
        exitBtn.quaternion.copy(quat);

        for (const m of stickyMeshes) m.lookAt(tx, m.position.y, tz);

        lastPoses = [];
        for (const src of frame.session.inputSources) {
          if (!src.targetRaySpace) continue;
          const rp = frame.getPose(src.targetRaySpace, refSpace);
          if (!rp) continue;
          const p = rp.transform.position, o = rp.transform.orientation;
          lastPoses.push({ x: p.x, y: p.y, z: p.z, qx: o.x, qy: o.y, qz: o.z, qw: o.w });
        }

        renderer.render(scene, xrCam);
      });

      session.addEventListener('selectend', () => {
        for (const p of lastPoses) {
          const origin = new THREE.Vector3(p.x, p.y, p.z);
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
          const rc = new THREE.Raycaster(origin, dir);
          if (rc.intersectObject(continueBtn).length > 0) { session.end().catch(() => {}); onComplete(); return; }
          if (rc.intersectObject(exitBtn).length > 0) { session.end().catch(() => {}); onExit(); return; }
        }
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
  }, []);  // intentionally runs once — session lifecycle owns its own teardown

  return null;
}
