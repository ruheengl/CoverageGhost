import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { scanFrame } from '../lib/api';

const BUCKETS = 5;
const BUCKET_DEG = 360 / BUCKETS;
const MIN_BUCKETS_COMPLETE = 0;

const WHEEL_PHASES = ['setup-fl', 'setup-fr', 'setup-rr', 'setup-rl'];
const WHEEL_LABELS = ['Front-Left\nWheel', 'Front-Right\nWheel', 'Rear-Right\nWheel', 'Rear-Left\nWheel'];

// ── Design tokens (dark charcoal, Apple-like) ────────────────────────────────
const P_BG     = 'rgba(22,24,30,0.92)';
const P_BORDER = 'rgba(255,255,255,0.1)';
const T1       = '#ffffff';
const T2       = 'rgba(255,255,255,0.55)';
const T3       = 'rgba(255,255,255,0.3)';
const ACCENT   = '#ff3b30'; // recording indicator only

export default function ImmersiveScan({ onCapture, onExit }) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    let phase = 'setup-fl';
    let wheelPoints = [null, null, null, null];
    let carCenter = null, carLength = 4.5, scanRadius = 3.5;
    let buckets = new Array(BUCKETS).fill(null);
    let voiceNotes = [];
    let annotating = false;
    let tooClose = false;
    let lastViewerT = null, lastViewerFwd = null;
    let lastFloorY = 0;
    let bucketCooldowns = new Array(BUCKETS).fill(0);
    let lastPanelDraw = 0;
    let lastRingUpdate = 0;
    let currentBucket = 0;
    let renderer, session, scene, refSpace, hitTestSource, stream;
    let ringMeshes = [];  // [0]=ring line, [1..BUCKETS]=tick lines
    let stickyNotes = [];
    let activeAudio = null;
    let activeAudioMesh = null;
    let gripHeld = false;
    let grippedStickyIdx = -1;
    let gripPreviewPos = null;
    const scanId = Date.now();
    let analysisInFlight = false;
    let lastControllerPoses = [];
    let grabbedDiscIdx = -1;
    let pendingNotePos = null;
    let activeStickyMesh = null;
    let wheelsLocked = false;

    const mCanvas = document.createElement('canvas');
    mCanvas.width = 512; mCanvas.height = 256;
    const mc = mCanvas.getContext('2d');
    let mTex, mPanel;

    const vCanvas = document.createElement('canvas');
    vCanvas.width = 512; vCanvas.height = 280;
    const vc = vCanvas.getContext('2d');
    let vTex, vPanel;

    const dCanvas = document.createElement('canvas');
    dCanvas.width = 512; dCanvas.height = 340;
    const dc = dCanvas.getContext('2d');
    let dTex, dPanel;

    // ── Drawing helpers ──────────────────────────────────────────────────────

    function drawSetup(stepIdx) {
      mc.clearRect(0, 0, 512, 256);
      mc.fillStyle = P_BG; rrect(mc, 0, 0, 512, 256, 24); mc.fill();
      mc.strokeStyle = P_BORDER; mc.lineWidth = 1.5;
      rrect(mc, 0, 0, 512, 256, 24); mc.stroke();

      // Step dots
      for (let i = 0; i < 4; i++) {
        mc.beginPath(); mc.arc(176 + i * 54, 36, 8, 0, Math.PI * 2);
        mc.fillStyle = i === stepIdx ? T1 : i < stepIdx ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)';
        mc.fill();
      }

      mc.fillStyle = T1; mc.font = 'bold 20px "DM Sans",Arial'; mc.textAlign = 'center';
      mc.fillText('Place wheel on ground', 256, 80);
      mc.font = '24px "DM Sans",Arial'; mc.fillStyle = T1;
      const label = WHEEL_LABELS[stepIdx];
      label.split('\n').forEach((l, i) => mc.fillText(l, 256, 120 + i * 32));
      mc.fillStyle = T3; mc.font = '14px "DM Sans",Arial';
      mc.fillText('Pull trigger to place', 256, 206);
      mTex.needsUpdate = true;
    }

    function drawConfirm() {
      mc.clearRect(0, 0, 512, 256);
      mc.fillStyle = P_BG; rrect(mc, 0, 0, 512, 256, 24); mc.fill();
      mc.strokeStyle = P_BORDER; mc.lineWidth = 1.5;
      rrect(mc, 0, 0, 512, 256, 24); mc.stroke();

      for (let i = 0; i < 4; i++) {
        mc.beginPath(); mc.arc(176 + i * 54, 36, 8, 0, Math.PI * 2);
        mc.fillStyle = T1; mc.fill();
      }
      mc.fillStyle = T1; mc.font = 'bold 22px "DM Sans",Arial'; mc.textAlign = 'center';
      mc.fillText('All 4 wheels placed', 256, 88);
      mc.fillStyle = T2; mc.font = '15px "DM Sans",Arial';
      mc.fillText('Grab and adjust discs if needed.', 256, 126);
      mc.fillText('Tap the Confirm button to begin scan.', 256, 150);
      mTex.needsUpdate = true;
    }

    function drawStatus() {
      const filled = buckets.filter(Boolean).length;
      mc.clearRect(0, 0, 512, 256);
      mc.fillStyle = P_BG; rrect(mc, 0, 0, 512, 256, 24); mc.fill();

      mc.fillStyle = T1; mc.font = 'bold 52px "DM Sans",Arial'; mc.textAlign = 'center';
      mc.textBaseline = 'middle';
      mc.fillText(`${filled} / ${BUCKETS}`, 256, 78);
      mc.textBaseline = 'alphabetic';
      mc.font = '13px "DM Sans",Arial'; mc.fillStyle = T3;
      mc.fillText('areas scanned', 256, 114);

      if (tooClose) {
        mc.fillStyle = ACCENT; mc.font = 'bold 16px "DM Sans",Arial';
        mc.fillText('Step back to the boundary ring', 256, 158);
      } else if (annotating) {
        mc.fillStyle = T1; mc.font = 'bold 16px "DM Sans",Arial';
        mc.fillText('Recording — pull trigger to save', 256, 158);
      } else if (filled >= MIN_BUCKETS_COMPLETE) {
        mc.fillStyle = T1; mc.font = 'bold 16px "DM Sans",Arial';
        mc.fillText('Pull trigger to complete scan', 256, 158);
        mc.fillStyle = T3; mc.font = '13px "DM Sans",Arial';
        mc.fillText('or keep walking for more coverage', 256, 184);
      } else {
        mc.fillStyle = T2; mc.font = '15px "DM Sans",Arial';
        mc.fillText('Walk the boundary ring around the car', 256, 158);
        mc.fillStyle = T3; mc.font = '13px "DM Sans",Arial';
        mc.fillText('Grip + release to add a voice note', 256, 182);
      }
      mTex.needsUpdate = true;
    }

    function drawVoice(text) {
      vc.clearRect(0, 0, 512, 280);
      vc.fillStyle = P_BG; rrect(vc, 0, 0, 512, 280, 22); vc.fill();
      vc.strokeStyle = P_BORDER; vc.lineWidth = 1.5;
      rrect(vc, 0, 0, 512, 280, 22); vc.stroke();
      // Red recording dot
      vc.fillStyle = ACCENT; vc.beginPath(); vc.arc(32, 38, 7, 0, Math.PI*2); vc.fill();
      vc.fillStyle = T1; vc.font = 'bold 16px "DM Sans",Arial'; vc.textAlign = 'left';
      vc.fillText('Voice Note', 48, 44);
      vc.fillStyle = T3; vc.font = '12px "DM Sans",Arial'; vc.textAlign = 'right';
      vc.fillText('pull trigger to save', 488, 44);
      // Thin separator
      vc.strokeStyle = P_BORDER; vc.lineWidth = 1;
      vc.beginPath(); vc.moveTo(20, 58); vc.lineTo(492, 58); vc.stroke();
      // Transcription
      vc.fillStyle = T2; vc.font = '16px "DM Sans",Arial'; vc.textAlign = 'left';
      const words = text.split(' ');
      let line = '', y = 84;
      for (const word of words) {
        const test = line + word + ' ';
        if (vc.measureText(test).width > 468 && line) {
          vc.fillText(line.trim(), 20, y); line = word + ' '; y += 24;
        } else line = test;
        if (y > 260) break;
      }
      if (line) vc.fillText(line.trim(), 20, y);
      vTex.needsUpdate = true;
    }

    function drawDamage(damage) {
      const areas = damage?.affected_areas || damage?.damaged_areas || [];
      dc.clearRect(0, 0, 512, 340);
      dc.fillStyle = P_BG; rrect(dc, 0, 0, 512, 340, 22); dc.fill();
      dc.strokeStyle = P_BORDER; dc.lineWidth = 1.5;
      rrect(dc, 0, 0, 512, 340, 22); dc.stroke();
      dc.fillStyle = T2; dc.font = '11px "DM Sans",Arial'; dc.textAlign = 'center';
      dc.fillText('LIVE ANALYSIS', 256, 28);
      dc.strokeStyle = P_BORDER; dc.lineWidth = 1;
      dc.beginPath(); dc.moveTo(20, 38); dc.lineTo(492, 38); dc.stroke();
      if (!areas.length) {
        dc.fillStyle = T3; dc.font = '14px "DM Sans",Arial';
        dc.fillText('No damage detected yet', 256, 100);
      } else {
        areas.slice(0, 5).forEach((area, i) => {
          const y = 48 + i * 56;
          dc.fillStyle = 'rgba(255,255,255,0.04)'; rrect(dc, 14, y, 484, 48, 8); dc.fill();
          const name = area.name || area.area_name || area.area || 'Unknown';
          dc.fillStyle = T1; dc.font = 'bold 13px "DM Sans",Arial'; dc.textAlign = 'left';
          dc.fillText(name, 26, y + 17);
          dc.fillStyle = T3; dc.font = '12px "DM Sans",Arial';
          const sev = area.severity || '';
          const desc = area.damage_type || area.description?.slice(0, 38) || '';
          dc.fillText([sev, desc].filter(Boolean).join(' · '), 26, y + 35);
        });
      }
      dTex.needsUpdate = true;
    }

    // ── Boundary ring (line ring + tick posts) ───────────────────────────────

    function createScanRing(scene) {
      ringMeshes.forEach(m => scene.remove(m));
      ringMeshes = [];

      // Main circular ring — Meta Quest guardian style
      const segments = 96;
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          carCenter.x + Math.cos(a) * scanRadius,
          lastFloorY + 0.015,
          carCenter.z + Math.sin(a) * scanRadius
        ));
      }
      const ringLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 })
      );
      scene.add(ringLine);
      ringMeshes.push(ringLine); // index 0

      // Vertical tick markers at each bucket position
      for (let i = 0; i < BUCKETS; i++) {
        const a = (i / BUCKETS) * Math.PI * 2;
        const bx = carCenter.x + Math.cos(a) * scanRadius;
        const bz = carCenter.z + Math.sin(a) * scanRadius;
        const tick = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(bx, lastFloorY + 0.01, bz),
            new THREE.Vector3(bx, lastFloorY + 0.32, bz),
          ]),
          new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.55 })
        );
        scene.add(tick);
        ringMeshes.push(tick); // indices 1..BUCKETS
      }
    }

    function updateRing() {
      // ringMeshes[0] = main ring (constant)
      // ringMeshes[1..BUCKETS] = tick lines
      for (let i = 0; i < BUCKETS; i++) {
        const tick = ringMeshes[i + 1];
        if (!tick) continue;
        if (i === currentBucket) {
          tick.material.color.set(tooClose ? 0xff3b30 : 0xffffff);
          tick.material.opacity = 0.95;
        } else if (buckets[i]) {
          tick.material.color.set(0x888888);
          tick.material.opacity = 0.65;
        } else {
          tick.material.color.set(0x444444);
          tick.material.opacity = 0.5;
        }
      }
    }

    // ── Frame capture ────────────────────────────────────────────────────────

    async function captureFrame(video, bIdx, angleDeg) {
      try {
        const w = video.videoWidth || 640, h = video.videoHeight || 480;
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        off.getContext('2d').drawImage(video, 0, 0);
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
        scanFrame({ frameBase64: b64, angle: angleDeg, bucketIndex: bIdx, scanId }).catch(() => {});
        return;
      }
      analysisInFlight = true;
      scanFrame({ frameBase64: b64, angle: angleDeg, bucketIndex: bIdx, scanId })
        .then(damage => { drawDamage(damage); if (dPanel) dPanel.visible = true; })
        .catch(e => console.warn('[ImmersiveScan] scanFrame:', e.message))
        .finally(() => { analysisInFlight = false; });
    }

    // ── Sticky notes — dark charcoal, compact ────────────────────────────────

    function makeStickyNote(pos) {
      const c = document.createElement('canvas');
      c.width = 480; c.height = 256;
      const tex = new THREE.CanvasTexture(c);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.20, 0.107),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
      );
      mesh.position.set(pos.x, pos.y + 0.1, pos.z);
      if (lastViewerT) mesh.lookAt(lastViewerT.x, mesh.position.y, lastViewerT.z);
      mesh._noteCanvas = c;
      mesh._noteTex = tex;
      scene.add(mesh);
      updateStickyText(mesh, 'Listening...');
      return mesh;
    }

    function updateStickyText(mesh, text) {
      const c = mesh._noteCanvas;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 480, 256);
      ctx.fillStyle = 'rgba(22,24,30,0.96)';
      rrect(ctx, 0, 0, 480, 256, 14); ctx.fill();
      ctx.strokeStyle = P_BORDER; ctx.lineWidth = 1;
      rrect(ctx, 0, 0, 480, 256, 14); ctx.stroke();
      // Header
      ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(24, 30, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = T1; ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
      ctx.fillText('Recording', 38, 35);
      ctx.strokeStyle = P_BORDER; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(12, 48); ctx.lineTo(468, 48); ctx.stroke();
      // Text
      ctx.fillStyle = T2; ctx.font = '14px Arial'; ctx.textAlign = 'left';
      const words = text.split(' ');
      let line = '', y = 68;
      for (const w of words) {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > 448 && line) { ctx.fillText(line.trim(), 14, y); line = w + ' '; y += 22; }
        else line = test;
        if (y > 240) break;
      }
      if (line) ctx.fillText(line.trim(), 14, y);
      mesh._noteTex.needsUpdate = true;
    }

    function updateStickyFinal(mesh, noteEntry, playing = false) {
      const c = mesh._noteCanvas;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 480, 256);
      ctx.fillStyle = 'rgba(22,24,30,0.96)';
      rrect(ctx, 0, 0, 480, 256, 14); ctx.fill();
      ctx.strokeStyle = P_BORDER; ctx.lineWidth = 1;
      rrect(ctx, 0, 0, 480, 256, 14); ctx.stroke();
      // Play button
      ctx.fillStyle = playing ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(26, 30, 18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = T1; ctx.font = '12px Arial'; ctx.textAlign = 'center';
      ctx.fillText(playing ? '⏸' : '▶', 27, 34);
      // White waveform bars
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      [9,18,28,14,22,32,16,26,20,30,12,24,18].forEach((h, i) => {
        ctx.fillRect(56 + i * 28, 30 - h/2, 10, h);
      });
      // Separator
      ctx.strokeStyle = P_BORDER; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(12, 54); ctx.lineTo(468, 54); ctx.stroke();
      // Text
      ctx.fillStyle = T2; ctx.font = '14px Arial'; ctx.textAlign = 'left';
      const text = noteEntry.text || '(no transcript)';
      const words = text.split(' ');
      let line = '', y = 74;
      for (const w of words) {
        const test = line + w + ' ';
        if (ctx.measureText(test).width > 448 && line) { ctx.fillText(line.trim(), 14, y); line = w + ' '; y += 22; }
        else line = test;
        if (y > 220) { ctx.fillText(line.trim() + '…', 14, y); line = null; break; }
      }
      if (line) ctx.fillText(line.trim(), 14, y);
      // Timestamp
      ctx.fillStyle = T3; ctx.font = '11px Arial'; ctx.textAlign = 'center';
      ctx.fillText(noteEntry.timestamp || '', 240, 246);
      mesh._noteTex.needsUpdate = true;
    }

    // ── Toolbar canvas (right side, head-locked) ──────────────────────────────

    function makeToolbar() {
      const c = document.createElement('canvas');
      c.width = 72; c.height = 280;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(22,24,30,0.88)';
      rrect(ctx, 0, 0, 72, 280, 18); ctx.fill();
      ctx.strokeStyle = P_BORDER; ctx.lineWidth = 1;
      rrect(ctx, 0, 0, 72, 280, 18); ctx.stroke();
      // Divider lines between icons
      [[36, 60], [36, 130], [36, 200]].forEach(([x, y]) => {
        ctx.strokeStyle = P_BORDER; ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(62, y); ctx.stroke();
      });
      // Icon text (emoji fallback — simple but clear)
      ctx.font = '22px Arial'; ctx.textAlign = 'center';
      ['📷', '🎙', '⚡', '✓'].forEach((ic, i) => ctx.fillText(ic, 36, 48 + i * 70));
      return c;
    }

    // ── Vosk WASM ────────────────────────────────────────────────────────────

    function rlog(msg, data) {
      console.log('[frontend]', msg, data ?? '');
      fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg, data }) }).catch(() => {});
    }

    let voskModel = null, voskRecognizer = null, audioContext = null;
    let audioSource = null, audioProcessor = null, micStream = null;
    let mediaRecorder = null, audioChunks = [];
    let pendingGeo = null, activeNoteCallbacks = null;

    function saveNotes() {
      fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, notes: voiceNotes }),
      }).catch(e => console.warn('[vosk] notes save failed:', e));
    }

    async function startVosk(meshSnapshot, noteSnapshot) {
      if (voskRecognizer || audioContext) return;
      activeNoteCallbacks = { mesh: meshSnapshot, noteEntry: noteSnapshot };
      if (meshSnapshot) updateStickyText(meshSnapshot, 'Loading...');
      drawVoice('Loading model...');

      if (!voskModel) {
        try {
          const { createModel } = await import('vosk-browser');
          voskModel = await Promise.race([
            createModel('/assets/vosk-model-small-en-us-0.15.tar.gz'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
          ]);
        } catch (e) {
          if (meshSnapshot) updateStickyText(meshSnapshot, 'Model file missing.');
          drawVoice('Voice unavailable. Trigger to cancel.');
          return;
        }
      }

      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false,
        });
        audioChunks = [];
        try {
          mediaRecorder = new MediaRecorder(micStream);
          mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
          mediaRecorder.start();
        } catch (_) { mediaRecorder = null; }
      } catch (e) {
        if (meshSnapshot) updateStickyText(meshSnapshot, 'Mic denied.');
        drawVoice('Mic denied — trigger to cancel');
        return;
      }

      audioContext = new AudioContext();
      await audioContext.resume();
      audioSource = audioContext.createMediaStreamSource(micStream);
      audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      voskRecognizer = new voskModel.KaldiRecognizer(audioContext.sampleRate);

      voskRecognizer.on('result', (msg) => {
        const text = msg.result?.text?.trim();
        if (!text) return;
        const prev = activeNoteCallbacks?.noteEntry?.text ?? '';
        const updated = prev ? `${prev} ${text}` : text;
        if (activeNoteCallbacks?.noteEntry) activeNoteCallbacks.noteEntry.text = updated;
        if (activeNoteCallbacks?.mesh) updateStickyText(activeNoteCallbacks.mesh, updated);
        drawVoice(updated);
      });

      voskRecognizer.on('partialresult', (msg) => {
        const partial = msg.result?.partial?.trim();
        if (!partial) return;
        const base = activeNoteCallbacks?.noteEntry?.text ?? '';
        const display = base ? `${base} ${partial}` : partial;
        if (activeNoteCallbacks?.mesh) updateStickyText(activeNoteCallbacks.mesh, display);
        drawVoice(display);
      });

      audioProcessor.onaudioprocess = (e) => { if (voskRecognizer) voskRecognizer.acceptWaveform(e.inputBuffer); };
      audioSource.connect(audioProcessor);
      audioProcessor.connect(audioContext.destination);
      if (meshSnapshot) updateStickyText(meshSnapshot, 'Listening...');
      drawVoice('Recording... pull trigger to save');
    }

    function stopVoskAudio() {
      try { audioProcessor?.disconnect(); } catch (_) {}
      try { audioSource?.disconnect(); } catch (_) {}
      try { audioContext?.close(); } catch (_) {}
      micStream?.getTracks().forEach(t => t.stop());
      audioProcessor = null; audioSource = null; audioContext = null; micStream = null;
    }

    function stopVosk() {
      if (voskRecognizer) { try { voskRecognizer.free(); } catch (_) {} voskRecognizer = null; }
      const text = activeNoteCallbacks?.noteEntry?.text?.trim() ?? '';

      if (activeNoteCallbacks) {
        const { mesh, noteEntry } = activeNoteCallbacks;
        if (noteEntry) noteEntry.text = text;
        noteEntry.lat = pendingGeo?.lat ?? null;
        noteEntry.lng = pendingGeo?.lng ?? null;
        noteEntry.timestamp = new Date().toLocaleString();

        const finalize = () => {
          if (mesh) updateStickyFinal(mesh, noteEntry);
          stickyNotes.push({ mesh, noteEntry });
        };

        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.onstop = () => {
            noteEntry.audioUrl = URL.createObjectURL(new Blob(audioChunks, { type: 'audio/webm' }));
            mediaRecorder = null;
            finalize();
          };
          mediaRecorder.stop();
        } else {
          noteEntry.audioUrl = null; mediaRecorder = null; finalize();
        }
        if (text) saveNotes();
      }

      stopVoskAudio();
      activeNoteCallbacks = null;
      annotating = false; pendingNotePos = null; activeStickyMesh = null;
      vPanel.visible = false;
      mPanel.visible = true;
      drawStatus();
    }

    function fallbackFloorPoint(dist) {
      if (!lastViewerT || !lastViewerFwd) return null;
      return { x: lastViewerT.x + lastViewerFwd.x * dist, y: lastFloorY, z: lastViewerT.z + lastViewerFwd.z * dist };
    }

    function recomputeCarGeometry(scene) {
      const pts = wheelPoints;
      carCenter = { x: pts.reduce((s, p) => s + p.x, 0) / 4, z: pts.reduce((s, p) => s + p.z, 0) / 4 };
      const fmx = (pts[0].x + pts[1].x) / 2, fmz = (pts[0].z + pts[1].z) / 2;
      const rmx = (pts[2].x + pts[3].x) / 2, rmz = (pts[2].z + pts[3].z) / 2;
      carLength = Math.max(Math.sqrt((fmx - rmx) ** 2 + (fmz - rmz) ** 2), 2);
      const carWidth = Math.max(
        Math.sqrt((pts[0].x - pts[1].x) ** 2 + (pts[0].z - pts[1].z) ** 2),
        Math.sqrt((pts[2].x - pts[3].x) ** 2 + (pts[2].z - pts[3].z) ** 2), 1
      );
      scanRadius = Math.sqrt((carLength / 2) ** 2 + (carWidth / 2) ** 2) + 0.3;
      createScanRing(scene);
    }

    // Proximity check for grabbing floor disc markers
    function rayDiscHit(poses, discs) {
      for (const p of poses) {
        for (let i = 0; i < discs.length; i++) {
          if (!discs[i].visible) continue;
          const dx = p.x - discs[i].position.x;
          const dz = p.z - discs[i].position.z;
          if (Math.sqrt(dx * dx + dz * dz) < 0.35 && Math.abs(p.y - discs[i].position.y) < 0.8) return i;
        }
      }
      // Raycaster fallback for aiming at disc from above/side
      for (const p of poses) {
        const origin = new THREE.Vector3(p.x, p.y, p.z);
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
        const hits = new THREE.Raycaster(origin, dir).intersectObjects(discs.filter(d => d.visible));
        if (hits.length > 0) return discs.findIndex(d => d === hits[0].object);
      }
      return -1;
    }

    async function start() {
      if (navigator.geolocation) {
        let watchId = null;
        pendingGeo = await new Promise(resolve => {
          const done = (geo) => { if (watchId != null) navigator.geolocation.clearWatch(watchId); resolve(geo); };
          watchId = navigator.geolocation.watchPosition(
            p => done({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => done(null),
            { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
          );
          setTimeout(() => done(pendingGeo), 8000);
        });
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch (e) { console.warn('[ImmersiveScan] camera:', e.message); }

      try {
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
      catch (_) { console.warn('[ImmersiveScan] no hit-test'); }

      scene = new THREE.Scene();

      // Status panel
      mTex = new THREE.CanvasTexture(mCanvas);
      mPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.22),
        new THREE.MeshBasicMaterial({ map: mTex, transparent: true, depthWrite: false })
      );
      scene.add(mPanel);
      drawSetup(0);

      // Voice panel (replaces status while recording)
      vTex = new THREE.CanvasTexture(vCanvas);
      vPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.44, 0.242),
        new THREE.MeshBasicMaterial({ map: vTex, transparent: true, depthWrite: false })
      );
      vPanel.visible = false;
      scene.add(vPanel);

      // Confirm button
      const confirmCanvas = document.createElement('canvas');
      confirmCanvas.width = 512; confirmCanvas.height = 96;
      const cCtx = confirmCanvas.getContext('2d');
      cCtx.fillStyle = 'rgba(22,24,30,0.94)';
      rrect(cCtx, 0, 0, 512, 96, 20); cCtx.fill();
      cCtx.strokeStyle = P_BORDER; cCtx.lineWidth = 1.5;
      rrect(cCtx, 0, 0, 512, 96, 20); cCtx.stroke();
      cCtx.fillStyle = '#1a3ecf';
      rrect(cCtx, 14, 12, 484, 72, 14); cCtx.fill();
      cCtx.fillStyle = T1; cCtx.font = 'bold 26px Arial'; cCtx.textAlign = 'center';
      cCtx.fillText('Confirm Wheel Placement', 256, 56);
      const confirmBtn = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.08),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(confirmCanvas), transparent: true, depthWrite: false })
      );
      confirmBtn.visible = false;
      scene.add(confirmBtn);

      // Damage analysis panel (left side)
      dTex = new THREE.CanvasTexture(dCanvas);
      dPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.295),
        new THREE.MeshBasicMaterial({ map: dTex, transparent: true, depthWrite: false })
      );
      dPanel.visible = false;
      scene.add(dPanel);

      // Complete scan button (bottom center)
      const exitCanvas = document.createElement('canvas');
      exitCanvas.width = 512; exitCanvas.height = 96;
      const eCtx = exitCanvas.getContext('2d');
      eCtx.fillStyle = 'rgba(22,24,30,0.92)';
      rrect(eCtx, 0, 0, 512, 96, 20); eCtx.fill();
      eCtx.strokeStyle = P_BORDER; eCtx.lineWidth = 1.5;
      rrect(eCtx, 0, 0, 512, 96, 20); eCtx.stroke();
      eCtx.fillStyle = T1; eCtx.font = 'bold 22px Arial'; eCtx.textAlign = 'center';
      eCtx.fillText('Complete Scan', 256, 54);
      const exitBtn = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.065),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(exitCanvas), transparent: true, depthWrite: false })
      );
      exitBtn.visible = false;
      scene.add(exitBtn);

      // Toolbar (right side)
      const toolbarTex = new THREE.CanvasTexture(makeToolbar());
      const toolbarPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.058, 0.225),
        new THREE.MeshBasicMaterial({ map: toolbarTex, transparent: true, depthWrite: false })
      );
      scene.add(toolbarPanel);

      // Wheel flat disc markers — blue, on floor (matching design 9.1)
      const wheelDiscs = WHEEL_LABELS.map(() => {
        const m = new THREE.Mesh(
          new THREE.CircleGeometry(0.095, 32),
          new THREE.MeshBasicMaterial({ color: 0x1a3ecf, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
        );
        m.rotation.x = -Math.PI / 2; // lay flat on floor
        m.visible = false;
        scene.add(m);
        return m;
      });

      // Floor cursor ring
      const cursor = new THREE.Mesh(
        new THREE.RingGeometry(0.065, 0.1, 40),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
      );
      cursor.rotation.x = -Math.PI / 2;
      cursor.visible = false;
      scene.add(cursor);

      // Note placement preview dot
      const notePreview = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      notePreview.rotation.x = -Math.PI / 2;
      notePreview.visible = false;
      scene.add(notePreview);

      // Controller rays — subtle white
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3),
      ]);
      const leftRay  = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
      const rightRay = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
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
        const fwd   = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
        const left  = new THREE.Vector3(-1, 0, 0).applyQuaternion(quat);

        lastViewerT   = { x: tx, y: ty, z: tz };
        lastViewerFwd = { x: fwd.x, y: fwd.y, z: fwd.z };

        const D = 0.9;

        if (mPanel.visible) {
          mPanel.position.set(tx + fwd.x*D, ty + 0.09 + fwd.y*D, tz + fwd.z*D);
          mPanel.quaternion.copy(quat);
        }
        if (vPanel.visible) {
          vPanel.position.set(tx + fwd.x*D, ty + 0.05 + fwd.y*D, tz + fwd.z*D);
          vPanel.quaternion.copy(quat);
        }
        if (dPanel.visible) {
          dPanel.position.set(tx + fwd.x*D + left.x*0.52, ty - 0.02 + fwd.y*D, tz + fwd.z*D + left.z*0.52);
          dPanel.quaternion.copy(quat);
        }
        if (confirmBtn.visible) {
          confirmBtn.position.set(tx + fwd.x*D, ty - 0.18 + fwd.y*D, tz + fwd.z*D);
          confirmBtn.quaternion.copy(quat);
        }
        if (exitBtn.visible) {
          exitBtn.position.set(tx + fwd.x*D, ty - 0.24 + fwd.y*D, tz + fwd.z*D);
          exitBtn.quaternion.copy(quat);
        }
        toolbarPanel.position.set(tx + fwd.x*D + right.x*0.44, ty + fwd.y*D, tz + fwd.z*D + right.z*0.44);
        toolbarPanel.quaternion.copy(quat);

        // Controller poses
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
          lastControllerPoses.push({ x: rt.x, y: rt.y, z: rt.z, qx: rq.x, qy: rq.y, qz: rq.z, qw: rq.w });
        }

        if (hitTestSource && (WHEEL_PHASES.includes(phase) || phase === 'confirm')) {
          const hits = frame.getHitTestResults(hitTestSource);
          if (hits.length > 0) lastFloorY = hits[0].getPose(refSpace).transform.position.y;
        }

        if (WHEEL_PHASES.includes(phase)) {
          const floorPt = rayFloorIntersect(lastControllerPoses, lastFloorY);
          if (floorPt) { cursor.position.set(floorPt.x, lastFloorY + 0.01, floorPt.z); cursor.visible = true; }
          else cursor.visible = false;
        } else cursor.visible = false;

        if (grabbedDiscIdx !== -1 && !wheelsLocked) {
          const floorPt = rayFloorIntersect(lastControllerPoses, lastFloorY);
          if (floorPt) wheelDiscs[grabbedDiscIdx].position.set(floorPt.x, lastFloorY + 0.005, floorPt.z);
        }

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

          if (buckets.filter(Boolean).length >= MIN_BUCKETS_COMPLETE) exitBtn.visible = true;
          if (time - lastRingUpdate > 100) { lastRingUpdate = time; updateRing(); }
          if (time - lastPanelDraw > 150) { lastPanelDraw = time; drawStatus(); }

          if (activeStickyMesh) activeStickyMesh.lookAt(tx, activeStickyMesh.position.y, tz);

          // Note placement preview
          if (gripHeld && !annotating && grippedStickyIdx === -1 && lastControllerPoses.length > 0) {
            const floorHit = rayFloorIntersect(lastControllerPoses, lastFloorY);
            let previewPos = null;
            if (floorHit && carCenter) {
              const dx = floorHit.x - carCenter.x, dz = floorHit.z - carCenter.z;
              if (Math.sqrt(dx*dx + dz*dz) <= scanRadius + 0.8) {
                previewPos = { x: floorHit.x, y: lastFloorY + 0.005, z: floorHit.z };
              }
            }
            if (!previewPos && lastControllerPoses.length > 0) {
              const p = lastControllerPoses[0];
              const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
              // Place note 0.8m ahead of the controller — closer than before
              previewPos = { x: p.x + dir.x * 0.8, y: lastFloorY + 0.005, z: p.z + dir.z * 0.8 };
            }
            gripPreviewPos = previewPos;
            if (previewPos) {
              notePreview.position.set(previewPos.x, previewPos.y, previewPos.z);
              notePreview.visible = true;
            }
          } else {
            notePreview.visible = false;
          }

          // Drag grabbed sticky
          if (grippedStickyIdx !== -1 && lastControllerPoses.length > 0) {
            const p = lastControllerPoses[0];
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
            stickyNotes[grippedStickyIdx].mesh.position.set(p.x + dir.x*0.9, p.y + dir.y*0.9, p.z + dir.z*0.9);
          }
        } else {
          notePreview.visible = false;
        }

        renderer.render(scene, xrCam);
      });

      session.addEventListener('selectstart', () => {
        if (phase === 'complete' || wheelsLocked) return;
        const hitIdx = rayDiscHit(lastControllerPoses, wheelDiscs);
        if (hitIdx !== -1) {
          grabbedDiscIdx = hitIdx;
          wheelDiscs[hitIdx].material.opacity = 1.0; // brighten while held
        }
      });

      session.addEventListener('selectend', () => {
        if (phase === 'complete') return;

        if (phase === 'confirm') {
          for (const p of lastControllerPoses) {
            const origin = new THREE.Vector3(p.x, p.y, p.z);
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
            if (new THREE.Raycaster(origin, dir).intersectObject(confirmBtn).length > 0) {
              wheelsLocked = true; confirmBtn.visible = false;
              recomputeCarGeometry(scene); phase = 'scanning'; drawStatus();
              return;
            }
          }
        }

        // Complete scan button
        for (const p of lastControllerPoses) {
          const origin = new THREE.Vector3(p.x, p.y, p.z);
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
          if (new THREE.Raycaster(origin, dir).intersectObject(exitBtn).length > 0) {
            phase = 'complete';
            fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scanId, notes: voiceNotes }) }).catch(() => {});
            onCapture(buckets.filter(Boolean), voiceNotes);
            session.end().catch(() => {});
            return;
          }
        }

        // Release grabbed disc
        if (grabbedDiscIdx !== -1) {
          const dp = wheelDiscs[grabbedDiscIdx].position;
          wheelPoints[grabbedDiscIdx] = { x: dp.x, y: lastFloorY, z: dp.z };
          wheelDiscs[grabbedDiscIdx].material.opacity = 0.75;
          grabbedDiscIdx = -1;
          if (wheelPoints.every(Boolean) && phase === 'scanning') recomputeCarGeometry(scene);
          return;
        }

        const phaseIdx = WHEEL_PHASES.indexOf(phase);
        if (phaseIdx !== -1) {
          const pt = rayFloorIntersect(lastControllerPoses, lastFloorY) ?? fallbackFloorPoint(3);
          if (pt) {
            wheelPoints[phaseIdx] = { x: pt.x, y: pt.y, z: pt.z };
            wheelDiscs[phaseIdx].position.set(pt.x, lastFloorY + 0.005, pt.z);
            wheelDiscs[phaseIdx].visible = true;
            const nextIdx = phaseIdx + 1;
            if (nextIdx < WHEEL_PHASES.length) { phase = WHEEL_PHASES[nextIdx]; drawSetup(nextIdx); }
            else { phase = 'confirm'; drawConfirm(); confirmBtn.visible = true; }
          }
          return;
        }

        if (phase === 'scanning') {
          if (annotating) { stopVosk(); return; }

          // Play/pause sticky note audio
          for (const p of lastControllerPoses) {
            const origin = new THREE.Vector3(p.x, p.y, p.z);
            const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
            const hits = new THREE.Raycaster(origin, dir).intersectObjects(stickyNotes.map(n => n.mesh));
            if (hits.length > 0 && hits[0].uv) {
              const { x: u, y: v } = hits[0].uv;
              if (u < 0.15 && v > 0.78) {
                const hit = stickyNotes.find(n => n.mesh === hits[0].object);
                if (hit?.noteEntry?.audioUrl) {
                  if (activeAudio && activeAudioMesh === hit.mesh) {
                    activeAudio.pause(); activeAudio = null; activeAudioMesh = null;
                    updateStickyFinal(hit.mesh, hit.noteEntry, false);
                  } else {
                    if (activeAudio) {
                      activeAudio.pause();
                      const prev = stickyNotes.find(n => n.mesh === activeAudioMesh);
                      if (prev) updateStickyFinal(prev.mesh, prev.noteEntry, false);
                    }
                    activeAudio = new Audio(hit.noteEntry.audioUrl);
                    activeAudioMesh = hit.mesh;
                    updateStickyFinal(hit.mesh, hit.noteEntry, true);
                    activeAudio.onended = () => {
                      activeAudio = null; activeAudioMesh = null;
                      updateStickyFinal(hit.mesh, hit.noteEntry, false);
                    };
                    activeAudio.play().catch(() => {});
                  }
                  return;
                }
              }
            }
          }
        }
      });

      session.addEventListener('squeezestart', () => {
        if (phase !== 'scanning' || annotating) return;
        for (const p of lastControllerPoses) {
          const origin = new THREE.Vector3(p.x, p.y, p.z);
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw)).normalize();
          const hits = new THREE.Raycaster(origin, dir).intersectObjects(stickyNotes.map(n => n.mesh));
          if (hits.length > 0) { grippedStickyIdx = stickyNotes.findIndex(n => n.mesh === hits[0].object); return; }
        }
        gripHeld = true; gripPreviewPos = null;
      });

      session.addEventListener('squeezeend', () => {
        if (grippedStickyIdx !== -1) { grippedStickyIdx = -1; return; }
        if (!gripHeld || !gripPreviewPos || annotating) { gripHeld = false; return; }
        gripHeld = false;
        notePreview.visible = false;

        pendingNotePos = gripPreviewPos;
        gripPreviewPos = null;

        // Place sticky note slightly above floor at preview location, at comfortable height
        const noteWorldPos = {
          x: pendingNotePos.x,
          y: Math.max(lastViewerT?.y - 0.35 ?? lastFloorY + 0.9, lastFloorY + 0.5),
          z: pendingNotePos.z,
        };
        if (scene) activeStickyMesh = makeStickyNote(noteWorldPos);

        const noteAzDeg = (carCenter && lastViewerT)
          ? ((Math.atan2(lastViewerT.z - carCenter.z, lastViewerT.x - carCenter.x) * 180 / Math.PI) + 360) % 360
          : currentBucket * BUCKET_DEG;
        const noteEntry = { id: String(Date.now()), text: '', angle: noteAzDeg, position3d: noteWorldPos };
        voiceNotes.push(noteEntry);

        annotating = true;
        mPanel.visible = false;
        vPanel.visible = true;
        drawVoice('Recording...');
        startVosk(activeStickyMesh, noteEntry);
      });

      session.addEventListener('end', () => {
        stopVosk();
        stream?.getTracks().forEach(t => t.stop());
        renderer.dispose();
        renderer.domElement.remove();
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

function rayFloorIntersect(poses, floorY = 0) {
  for (const p of poses) {
    const quat = new THREE.Quaternion(p.qx, p.qy, p.qz, p.qw);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    if (Math.abs(dir.y) < 0.01) continue;
    const t = (floorY - p.y) / dir.y;
    if (t < 0) continue;
    return { x: p.x + dir.x * t, y: floorY, z: p.z + dir.z * t };
  }
  return null;
}
