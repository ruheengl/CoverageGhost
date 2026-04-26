import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { scanFrame } from '../lib/api';

const BUCKETS = 18;
const BUCKET_DEG = 360 / BUCKETS;
// DEBUG: set to 0 so scan can be completed at any time regardless of coverage.
// Change back to 12 (two-thirds of 18 buckets) for production.
const MIN_BUCKETS_COMPLETE = 0;

// 4-wheel setup phases in order
const WHEEL_PHASES = ['setup-fl', 'setup-fr', 'setup-rr', 'setup-rl'];
const WHEEL_LABELS = ['Front-Left\nWheel', 'Front-Right\nWheel', 'Rear-Right\nWheel', 'Rear-Left\nWheel'];
const WHEEL_COLORS = [0x0d9488, 0x22c55e, 0xef4444, 0xfbbf24];

export default function ImmersiveScan({ onCapture, onExit }) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    let phase = 'setup-fl';
    let wheelPoints = [null, null, null, null]; // fl, fr, rr, rl
    let carCenter = null, carLength = 4.5, scanRadius = 3.5;
    let buckets = new Array(BUCKETS).fill(null);
    let voiceNotes = [];
    let annotating = false;
    let tooClose = false;
    let currentTranscript = '';
    let recognition = null;
    let lastHitPoint = null;
    let lastViewerT = null, lastViewerFwd = null;
    let lastFloorY = 0; // real floor Y in current reference space, updated via hit-test
    let bucketCooldowns = new Array(BUCKETS).fill(0);
    let lastPanelDraw = 0;
    let lastRingUpdate = 0;
    let currentBucket = 0;
    let renderer, session, refSpace, hitTestSource, stream;
    let ringMeshes = [];
    const scanId = Date.now();
    let analysisInFlight = false;
    let lastControllerPoses = []; // cached each XR frame from targetRaySpace
    let lastDebugPt = null; // last placed wheel point for on-screen debug
    let grabbedSphereIdx = -1; // index of wheel sphere currently being dragged (-1 = none)

    // Head-locked status panel (text only — no 2D ring)
    const mCanvas = document.createElement('canvas');
    mCanvas.width = 512; mCanvas.height = 256;
    const mc = mCanvas.getContext('2d');
    let mTex;

    // Voice note panel
    const vCanvas = document.createElement('canvas');
    vCanvas.width = 512; vCanvas.height = 300;
    const vc = vCanvas.getContext('2d');
    let vTex, vPanel;

    // Live damage analysis panel
    const dCanvas = document.createElement('canvas');
    dCanvas.width = 512; dCanvas.height = 360;
    const dc = dCanvas.getContext('2d');
    let dTex, dPanel;

    // ── Drawing helpers ──────────────────────────────────────────────────────

    function drawSetup(stepIdx) {
      const label = WHEEL_LABELS[stepIdx];
      mc.clearRect(0, 0, 512, 256);
      mc.fillStyle = 'rgba(15,23,42,0.92)';
      rrect(mc, 0, 0, 512, 256, 32); mc.fill();
      mc.strokeStyle = WHEEL_COLORS[stepIdx] ? `#${WHEEL_COLORS[stepIdx].toString(16).padStart(6,'0')}` : '#0d9488';
      mc.lineWidth = 3; rrect(mc, 0, 0, 512, 256, 32); mc.stroke();

      // Step dots
      mc.fillStyle = 'rgba(255,255,255,0.2)';
      for (let i = 0; i < 4; i++) {
        mc.beginPath();
        mc.arc(176 + i * 54, 36, 10, 0, Math.PI * 2);
        mc.fillStyle = i < stepIdx ? '#0d9488' : i === stepIdx ? '#34d399' : 'rgba(255,255,255,0.2)';
        mc.fill();
      }

      mc.fillStyle = 'white'; mc.font = 'bold 24px Arial'; mc.textAlign = 'center';
      mc.fillText('Tap wheel on ground', 256, 80);
      mc.font = '28px Arial'; mc.fillStyle = '#34d399';
      label.split('\n').forEach((l, i) => mc.fillText(l, 256, 126 + i * 36));
      mc.fillStyle = 'rgba(255,255,255,0.4)'; mc.font = '17px Arial';
      mc.fillText('Pull trigger to place', 256, 210);

      // Debug: show last placed point coordinates
      if (lastDebugPt) {
        mc.fillStyle = '#fbbf24'; mc.font = '14px monospace';
        mc.fillText(
          `last: x=${lastDebugPt.x.toFixed(3)}  y=${lastDebugPt.y.toFixed(3)}  z=${lastDebugPt.z.toFixed(3)}`,
          256, 238
        );
      }
      mTex.needsUpdate = true;
    }

    function drawStatus() {
      const filled = buckets.filter(Boolean).length;
      mc.clearRect(0, 0, 512, 256);
      mc.fillStyle = 'rgba(15,23,42,0.88)';
      rrect(mc, 0, 0, 512, 256, 32); mc.fill();

      mc.fillStyle = 'white'; mc.font = 'bold 48px Arial'; mc.textAlign = 'center';
      mc.textBaseline = 'middle';
      mc.fillText(`${filled} / ${BUCKETS}`, 256, 80);
      mc.textBaseline = 'alphabetic';
      mc.font = '16px Arial'; mc.fillStyle = 'rgba(255,255,255,0.45)';
      mc.fillText('areas scanned', 256, 116);

      if (tooClose) {
        mc.fillStyle = '#f87171'; mc.font = 'bold 20px Arial';
        mc.fillText('⚠ Step back to the ring', 256, 160);
      } else if (annotating) {
        mc.fillStyle = '#fbbf24'; mc.font = 'bold 20px Arial';
        mc.fillText('🎙 Recording... pull trigger to save', 256, 160);
      } else if (filled >= MIN_BUCKETS_COMPLETE) {
        mc.fillStyle = '#34d399'; mc.font = 'bold 20px Arial';
        mc.fillText('✓ Pull trigger to complete scan', 256, 160);
        mc.fillStyle = 'rgba(255,255,255,0.35)'; mc.font = '16px Arial';
        mc.fillText('or keep walking for more coverage', 256, 190);
      } else {
        mc.fillStyle = 'rgba(255,255,255,0.5)'; mc.font = '18px Arial';
        mc.fillText('Walk along the ring around the car', 256, 160);
        mc.fillStyle = 'rgba(255,255,255,0.3)'; mc.font = '15px Arial';
        mc.fillText('Pull trigger to add a voice note', 256, 190);
      }
      mTex.needsUpdate = true;
    }

    function drawVoice(text) {
      vc.clearRect(0, 0, 512, 300);
      vc.fillStyle = 'rgba(15,23,42,0.93)';
      rrect(vc, 0, 0, 512, 300, 28); vc.fill();
      vc.strokeStyle = '#fbbf24'; vc.lineWidth = 2.5;
      rrect(vc, 0, 0, 512, 300, 28); vc.stroke();
      vc.fillStyle = '#fbbf24'; vc.font = '24px Arial'; vc.textAlign = 'center';
      vc.fillText('🎙 Field Note', 256, 46);
      vc.fillStyle = 'white'; vc.font = '19px Arial';
      const words = text.split(' ');
      let line = '', y = 86;
      for (const word of words) {
        const test = line + word + ' ';
        if (vc.measureText(test).width > 460 && line) {
          vc.fillText(line.trim(), 256, y); line = word + ' '; y += 28;
        } else { line = test; }
      }
      if (line) vc.fillText(line.trim(), 256, y);
      vc.fillStyle = 'rgba(255,255,255,0.4)'; vc.font = '16px Arial';
      vc.fillText('Pull trigger to save & continue', 256, 268);
      vTex.needsUpdate = true;
    }

    function drawDamage(damage) {
      const areas = damage?.affected_areas || damage?.damaged_areas || [];
      dc.clearRect(0, 0, 512, 360);
      dc.fillStyle = 'rgba(15,23,42,0.93)';
      rrect(dc, 0, 0, 512, 360, 28); dc.fill();
      dc.strokeStyle = '#34d399'; dc.lineWidth = 2;
      rrect(dc, 0, 0, 512, 360, 28); dc.stroke();
      dc.fillStyle = '#34d399'; dc.font = 'bold 19px Arial'; dc.textAlign = 'center';
      dc.fillText('Live Analysis', 256, 34);
      if (!areas.length) {
        dc.fillStyle = 'rgba(255,255,255,0.4)'; dc.font = '16px Arial';
        dc.fillText('No damage detected', 256, 100);
      } else {
        areas.slice(0, 5).forEach((area, i) => {
          const y = 54 + i * 58;
          const sev = (area.severity || '').toLowerCase();
          const col = sev === 'severe' ? 'rgba(239,68,68,0.25)' : sev === 'moderate' ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.15)';
          dc.fillStyle = col; rrect(dc, 16, y, 480, 50, 10); dc.fill();
          const name = area.name || area.area_name || area.area || 'Unknown';
          dc.fillStyle = 'white'; dc.font = 'bold 15px Arial'; dc.textAlign = 'left';
          dc.fillText(name, 28, y + 18);
          dc.fillStyle = 'rgba(255,255,255,0.6)'; dc.font = '13px Arial';
          dc.fillText(`${area.severity || ''} · ${area.damage_type || area.description?.slice(0, 40) || ''}`.replace(/^ · | · $/, ''), 28, y + 36);
        });
      }
      dTex.needsUpdate = true;
    }

    // ── Ring (world-space 3D arc segments) ──────────────────────────────────

    function createScanRing(scene) {
      ringMeshes = [];
      // Vertical pillars — visible from standing height, not flat on floor
      const geo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
      for (let i = 0; i < BUCKETS; i++) {
        const a = (i / BUCKETS) * Math.PI * 2;
        const mat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          carCenter.x + Math.cos(a) * scanRadius,
          0.25, // base at floor, top at 0.5m
          carCenter.z + Math.sin(a) * scanRadius
        );
        scene.add(mesh);
        ringMeshes.push(mesh);
      }
    }

    function updateRing() {
      ringMeshes.forEach((mesh, i) => {
        if (i === currentBucket) {
          mesh.material.color.set(tooClose ? 0xef4444 : 0x34d399);
        } else if (buckets[i]) {
          mesh.material.color.set(0x0d9488);
        } else {
          mesh.material.color.set(0x1e293b);
        }
      });
    }

    // ── Frame capture + combined API ─────────────────────────────────────────

    async function captureFrame(video, bIdx, angleDeg) {
      try {
        const w = video.videoWidth || 640, h = video.videoHeight || 480;
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const c = off.getContext('2d');
        c.drawImage(video, 0, 0);
        // Only capture once per bucket — first frame wins
        if (!buckets[bIdx]) {
          const b64 = off.toDataURL('image/jpeg', 0.88).split(',')[1];
          const blob = await new Promise(res => off.toBlob(res, 'image/jpeg', 0.88));
          buckets[bIdx] = { frameBlob: blob, sharpness: 0, angle: angleDeg };
          uploadAndAnalyze(b64, angleDeg, bIdx);
        }
      } catch (_) {}
    }

    function uploadAndAnalyze(b64, angleDeg, bIdx) {
      if (analysisInFlight) {
        // Still upload/save even when analysis is in flight — just skip drawing result
        scanFrame({ frameBase64: b64, angle: angleDeg, bucketIndex: bIdx, scanId })
          .catch(e => console.warn('[ImmersiveScan] upload:', e.message));
        return;
      }
      analysisInFlight = true;
      scanFrame({ frameBase64: b64, angle: angleDeg, bucketIndex: bIdx, scanId })
        .then(damage => {
          drawDamage(damage);
          if (dPanel) dPanel.visible = true;
        })
        .catch(e => console.warn('[ImmersiveScan] scanFrame:', e.message))
        .finally(() => { analysisInFlight = false; });
    }

    function computeSharpness(d) {
      let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 20) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        s += g; s2 += g * g; n++;
      }
      const m = s / n;
      return s2 / n - m * m;
    }

    function startVoice() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { drawVoice('Voice not supported.\nPull trigger to save.'); return; }
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) currentTranscript += e.results[i][0].transcript + ' ';
          else interim = e.results[i][0].transcript;
        }
        drawVoice((currentTranscript + interim).trim() || 'Listening...');
      };
      recognition.onerror = () => drawVoice('Mic error. Pull trigger to save.');
      recognition.start();
    }

    function stopVoice() {
      try { recognition?.stop(); } catch (_) {}
      recognition = null;
    }

    function fallbackFloorPoint(dist) {
      if (!lastViewerT || !lastViewerFwd) return null;
      return { x: lastViewerT.x + lastViewerFwd.x * dist, y: lastFloorY, z: lastViewerT.z + lastViewerFwd.z * dist };
    }

    function recomputeCarGeometry(scene) {
      const pts = wheelPoints;
      carCenter = {
        x: pts.reduce((s, p) => s + p.x, 0) / 4,
        z: pts.reduce((s, p) => s + p.z, 0) / 4,
      };
      const frontMidX = (pts[0].x + pts[1].x) / 2, frontMidZ = (pts[0].z + pts[1].z) / 2;
      const rearMidX  = (pts[2].x + pts[3].x) / 2, rearMidZ  = (pts[2].z + pts[3].z) / 2;
      carLength = Math.max(Math.sqrt((frontMidX - rearMidX) ** 2 + (frontMidZ - rearMidZ) ** 2), 2);
      const carWidth = Math.max(
        Math.sqrt((pts[0].x - pts[1].x) ** 2 + (pts[0].z - pts[1].z) ** 2),
        Math.sqrt((pts[2].x - pts[3].x) ** 2 + (pts[2].z - pts[3].z) ** 2),
        1
      );
      scanRadius = Math.sqrt((carLength / 2) ** 2 + (carWidth / 2) ** 2) + 0.3;
      // Remove existing ring meshes and rebuild
      ringMeshes.forEach(m => scene.remove(m));
      ringMeshes = [];
      createScanRing(scene);
    }

    // Returns index of the wheel sphere whose center is within 0.25m of the controller ray, or -1
    function raySphereHit(poses, spheres) {
      for (const p of poses) {
        const quat = new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
        const origin = new THREE.Vector3(p.x, p.y, p.z);
        for (let i = 0; i < spheres.length; i++) {
          if (!spheres[i].visible) continue;
          const toSphere = spheres[i].position.clone().sub(origin);
          const proj = toSphere.dot(dir);
          if (proj < 0) continue;
          const dist = origin.clone().addScaledVector(dir, proj).distanceTo(spheres[i].position);
          if (dist < 0.25) return i;
        }
      }
      return -1;
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch (e) { console.warn('[ImmersiveScan] camera:', e.message); }

      try {
        // unbounded disables Guardian boundary warnings without changing the coordinate system.
        // local-floor keeps y=0 at the physical floor, which rayFloorIntersect depends on.
        session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor', 'unbounded'],
          optionalFeatures: ['hit-test', 'hand-tracking'],
        });
        sessionRef.current = session;
      } catch (e) { console.error('[ImmersiveScan] XR:', e); onExit(); return; }

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;';

      refSpace = renderer.xr.getReferenceSpace();
      const viewerSpace = await session.requestReferenceSpace('viewer');
      try { hitTestSource = await session.requestHitTestSource({ space: viewerSpace }); }
      catch (e) { console.warn('[ImmersiveScan] no hit-test, using fallback'); }

      const scene = new THREE.Scene();

      // Head-locked status panel
      mTex = new THREE.CanvasTexture(mCanvas);
      const mPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.22),
        new THREE.MeshBasicMaterial({ map: mTex, transparent: true, depthWrite: false })
      );
      scene.add(mPanel);
      drawSetup(0);

      // Voice panel
      vTex = new THREE.CanvasTexture(vCanvas);
      vPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.26),
        new THREE.MeshBasicMaterial({ map: vTex, transparent: true, depthWrite: false })
      );
      vPanel.visible = false;
      scene.add(vPanel);

      // Damage analysis panel
      dTex = new THREE.CanvasTexture(dCanvas);
      dPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.31),
        new THREE.MeshBasicMaterial({ map: dTex, transparent: true, depthWrite: false })
      );
      dPanel.visible = false;
      scene.add(dPanel);

      // Wheel marker spheres
      const wheelSpheres = WHEEL_COLORS.map(col => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 16, 16),
          new THREE.MeshBasicMaterial({ color: col })
        );
        m.visible = false;
        scene.add(m);
        return m;
      });

      // Floor cursor — ring that follows ray-floor intersection during setup
      const cursor = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.12, 32),
        new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      cursor.rotation.x = -Math.PI / 2;
      cursor.visible = false;
      scene.add(cursor);

      // Controller rays
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3),
      ]);
      const rayMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
      const leftRay = new THREE.Line(rayGeo, rayMat.clone());
      const rightRay = new THREE.Line(rayGeo, rayMat.clone());
      leftRay.visible = false; rightRay.visible = false;
      scene.add(leftRay, rightRay);

      const xrCam = new THREE.PerspectiveCamera();

      session.requestAnimationFrame(function loop(time, frame) {
        session.requestAnimationFrame(loop);
        if (phase === 'complete') return;

        const vp = frame.getViewerPose(refSpace);
        if (!vp) { renderer.render(scene, xrCam); return; }

        const { x: tx, y: ty, z: tz } = vp.transform.position;
        const q = vp.transform.orientation;
        const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

        lastViewerT = { x: tx, y: ty, z: tz };
        lastViewerFwd = { x: fwd.x, y: fwd.y, z: fwd.z };

        // Head-lock status panel (top of view)
        mPanel.position.set(tx + fwd.x * 0.9, ty + 0.08 + fwd.y * 0.9, tz + fwd.z * 0.9);
        mPanel.quaternion.copy(quat);

        // Voice panel (right of status panel)
        if (vPanel.visible) {
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
          vPanel.position.set(
            tx + fwd.x * 0.88 + right.x * 0.34,
            ty - 0.04 + fwd.y * 0.88,
            tz + fwd.z * 0.88 + right.z * 0.34
          );
          vPanel.quaternion.copy(quat);
        }

        // Damage panel (below status panel)
        if (dPanel.visible) {
          const left = new THREE.Vector3(-1, 0, 0).applyQuaternion(quat);
          dPanel.position.set(
            tx + fwd.x * 0.88 + left.x * 0.34,
            ty - 0.04 + fwd.y * 0.88,
            tz + fwd.z * 0.88 + left.z * 0.34
          );
          dPanel.quaternion.copy(quat);
        }

        // Controller rays — update pose cache for floor intersection on trigger
        leftRay.visible = false; rightRay.visible = false;
        lastControllerPoses = [];
        for (const src of session.inputSources) {
          if (!src.targetRaySpace) continue;
          const rp = frame.getPose(src.targetRaySpace, refSpace);
          if (!rp) continue;
          const rt = rp.transform.position, rq = rp.transform.orientation;
          const ray = src.handedness === 'left' ? leftRay : rightRay;
          ray.position.set(rt.x, rt.y, rt.z);
          ray.quaternion.set(rq.x, rq.y, rq.z, rq.w);
          ray.visible = true;
          // Cache position + orientation so selectend can compute floor intersection
          lastControllerPoses.push({ x: rt.x, y: rt.y, z: rt.z, qx: rq.x, qy: rq.y, qz: rq.z, qw: rq.w });
        }

        // Hit-test during setup — track real floor Y in current reference space
        if (hitTestSource && WHEEL_PHASES.includes(phase)) {
          const hits = frame.getHitTestResults(hitTestSource);
          if (hits.length > 0) lastFloorY = hits[0].getPose(refSpace).transform.position.y;
        }

        // Floor cursor — follows ray intersection during setup so user sees landing point
        if (WHEEL_PHASES.includes(phase)) {
          const floorPt = rayFloorIntersect(lastControllerPoses, lastFloorY);
          if (floorPt) {
            cursor.position.set(floorPt.x, lastFloorY + 0.01, floorPt.z);
            cursor.visible = true;
          } else {
            cursor.visible = false;
          }
        } else {
          cursor.visible = false;
        }

        // Grabbed sphere follows ray-floor intersection
        if (grabbedSphereIdx !== -1) {
          const floorPt = rayFloorIntersect(lastControllerPoses, lastFloorY);
          if (floorPt) {
            wheelSpheres[grabbedSphereIdx].position.set(floorPt.x, lastFloorY + 0.08, floorPt.z);
          }
        }

        // Scanning logic
        if (phase === 'scanning') {
          const { x: cx, z: cz } = carCenter;
          const distFromCenter = Math.sqrt((tx - cx) ** 2 + (tz - cz) ** 2);
          tooClose = distFromCenter < (scanRadius - 0.3);
          const azDeg = ((Math.atan2(tz - cz, tx - cx) * 180 / Math.PI) + 360) % 360;
          currentBucket = Math.floor(azDeg / BUCKET_DEG) % BUCKETS;

          const video = videoRef.current;
          if (!tooClose && !annotating && video?.videoWidth > 0 && time - bucketCooldowns[currentBucket] > 500) {
            bucketCooldowns[currentBucket] = time;
            captureFrame(video, currentBucket, azDeg);
          }

          if (time - lastRingUpdate > 100) { lastRingUpdate = time; updateRing(); }
          if (time - lastPanelDraw > 150) { lastPanelDraw = time; drawStatus(); }
        }

        renderer.render(scene, xrCam);
      });

      // Grab start — if ray is near a placed sphere, grab it instead of placing a new one
      session.addEventListener('selectstart', () => {
        if (phase === 'complete') return;
        const hitIdx = raySphereHit(lastControllerPoses, wheelSpheres);
        if (hitIdx !== -1) {
          grabbedSphereIdx = hitIdx;
          wheelSpheres[hitIdx].material.color.set(0xffffff); // flash white while held
        }
      });

      // Trigger handler
      session.addEventListener('selectend', () => {
        if (phase === 'complete') return;

        // Release grab — update wheel point and recompute car geometry
        if (grabbedSphereIdx !== -1) {
          const sp = wheelSpheres[grabbedSphereIdx].position;
          wheelPoints[grabbedSphereIdx] = { x: sp.x, y: lastFloorY, z: sp.z };
          wheelSpheres[grabbedSphereIdx].material.color.set(WHEEL_COLORS[grabbedSphereIdx]);
          grabbedSphereIdx = -1;
          // If all 4 placed and in scanning, recompute ring
          if (wheelPoints.every(Boolean) && phase === 'scanning') recomputeCarGeometry(scene);
          return;
        }

        const phaseIdx = WHEEL_PHASES.indexOf(phase);

        if (phaseIdx !== -1) {
          // Primary: intersect the controller ray with the floor plane (y=0)
          // This places the sphere exactly where the ray beam touches the ground.
          const pt = rayFloorIntersect(lastControllerPoses, lastFloorY) ?? fallbackFloorPoint(3);

          // Debug: log viewer Y, controller Y, floor Y, and computed intersection
          console.log('[ImmersiveScan] placement debug', {
            viewerY: lastViewerT?.y?.toFixed(3),
            lastFloorY: lastFloorY?.toFixed(3),
            controllers: lastControllerPoses.map(p => ({ y: p.y.toFixed(3), qy: p.qy.toFixed(3) })),
            intersectPt: pt ? { x: pt.x.toFixed(3), y: pt.y.toFixed(3), z: pt.z.toFixed(3) } : null,
          });

          if (pt) {
            lastDebugPt = pt;
            wheelPoints[phaseIdx] = { x: pt.x, y: pt.y, z: pt.z };
            wheelSpheres[phaseIdx].position.set(pt.x, pt.y + 0.08, pt.z);
            wheelSpheres[phaseIdx].visible = true;

            const nextIdx = phaseIdx + 1;
            if (nextIdx < WHEEL_PHASES.length) {
              phase = WHEEL_PHASES[nextIdx];
              drawSetup(nextIdx);
            } else {
              recomputeCarGeometry(scene);
              phase = 'scanning';
              drawStatus();
            }
          }
          return;
        }

        if (phase === 'scanning') {
          if (annotating) {
            stopVoice();
            const text = currentTranscript.trim();
            if (text) voiceNotes.push({ text, angle: currentBucket * BUCKET_DEG });
            currentTranscript = '';
            annotating = false;
            vPanel.visible = false;
            drawStatus();
            return;
          }

          if (tooClose) return;

          const filled = buckets.filter(Boolean).length;
          if (filled >= MIN_BUCKETS_COMPLETE) {
            phase = 'complete';
            onCapture(buckets.filter(Boolean), voiceNotes);
            session.end().catch(() => {});
            return;
          }

          annotating = true;
          currentTranscript = '';
          vPanel.visible = true;
          drawVoice('Listening...');
          startVoice();
          drawStatus();
        }
      });

      session.addEventListener('end', () => {
        stream?.getTracks().forEach(t => t.stop());
        renderer.dispose();
        renderer.domElement.remove();
        stopVoice();
        onExit();
      });
    }

    start();
    return () => { sessionRef.current?.end().catch(() => {}); };
  }, []);

  return <video ref={videoRef} playsInline muted style={{ display: 'none' }} />;
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Intersect cached controller ray(s) with the floor plane at floorY.
// floorY comes from hit-test so it's correct regardless of reference space type.
// Returns { x, y: floorY, z } or null if no ray reaches the floor.
function rayFloorIntersect(poses, floorY = 0) {
  for (const p of poses) {
    const quat = new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    if (Math.abs(dir.y) < 0.01) continue; // nearly horizontal — skip
    const t = (floorY - p.y) / dir.y;    // solve: p.y + t*dir.y = floorY
    if (t < 0) continue;                  // floor is behind the ray
    return { x: p.x + dir.x * t, y: floorY, z: p.z + dir.z * t };
  }
  return null;
}
