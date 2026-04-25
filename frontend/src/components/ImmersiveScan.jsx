import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const BUCKETS = 18;
const BUCKET_DEG = 360 / BUCKETS;
const MIN_BUCKETS_COMPLETE = 12;
const MIN_DIST_FROM_EDGE = 0.8;

export default function ImmersiveScan({ onCapture, onExit }) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    let phase = 'setup-front';
    let frontPoint = null, rearPoint = null;
    let carCenter = null, carLength = 4.5;
    let buckets = new Array(BUCKETS).fill(null);
    let voiceNotes = [];
    let annotating = false;
    let tooClose = false;
    let currentTranscript = '';
    let recognition = null;
    let lastHitPoint = null;
    let lastViewerT = null, lastViewerFwd = null;
    let bucketCooldowns = new Array(BUCKETS).fill(0);
    let lastPanelDraw = 0;
    let currentBucket = 0;
    let renderer, session, refSpace, hitTestSource, stream;

    const mCanvas = document.createElement('canvas');
    mCanvas.width = 512; mCanvas.height = 512;
    const mc = mCanvas.getContext('2d');
    let mTex;

    const vCanvas = document.createElement('canvas');
    vCanvas.width = 512; vCanvas.height = 300;
    const vc = vCanvas.getContext('2d');
    let vTex, vPanel;

    function drawSetup(msg) {
      mc.clearRect(0, 0, 512, 512);
      mc.fillStyle = 'rgba(15,23,42,0.92)';
      rrect(mc, 0, 0, 512, 512, 40); mc.fill();
      mc.strokeStyle = '#0d9488'; mc.lineWidth = 3;
      rrect(mc, 0, 0, 512, 512, 40); mc.stroke();
      mc.fillStyle = '#99f6e4'; mc.font = 'bold 26px Arial';
      mc.textAlign = 'center'; mc.fillText('Coverage Ghost', 256, 58);
      mc.strokeStyle = '#0d9488'; mc.lineWidth = 4;
      mc.beginPath(); mc.arc(256, 190, 68, 0, Math.PI * 2); mc.stroke();
      mc.beginPath();
      mc.moveTo(256, 132); mc.lineTo(256, 248);
      mc.moveTo(188, 190); mc.lineTo(324, 190); mc.stroke();
      mc.fillStyle = 'white'; mc.font = '25px Arial';
      msg.split('\n').forEach((l, i) => mc.fillText(l, 256, 320 + i * 38));
      mc.fillStyle = 'rgba(255,255,255,0.4)'; mc.font = '19px Arial';
      mc.fillText('Pull trigger to place', 256, 438);
      mTex.needsUpdate = true;
    }

    function drawScan() {
      const filled = buckets.filter(Boolean).length;
      mc.clearRect(0, 0, 512, 512);
      mc.fillStyle = 'rgba(15,23,42,0.92)';
      rrect(mc, 0, 0, 512, 512, 40); mc.fill();

      const cx = 256, cy = 208, R = 128;
      for (let i = 0; i < BUCKETS; i++) {
        const a0 = (i / BUCKETS) * Math.PI * 2 - Math.PI / 2 + 0.07;
        const a1 = ((i + 1) / BUCKETS) * Math.PI * 2 - Math.PI / 2 - 0.07;
        mc.beginPath(); mc.arc(cx, cy, R, a0, a1);
        mc.strokeStyle = buckets[i] ? '#0d9488' : 'rgba(255,255,255,0.13)';
        mc.lineWidth = 22; mc.lineCap = 'round'; mc.stroke();
      }
      // Highlight current bucket
      {
        const a0 = (currentBucket / BUCKETS) * Math.PI * 2 - Math.PI / 2 + 0.07;
        const a1 = ((currentBucket + 1) / BUCKETS) * Math.PI * 2 - Math.PI / 2 - 0.07;
        mc.beginPath(); mc.arc(cx, cy, R, a0, a1);
        mc.strokeStyle = tooClose ? '#f87171' : '#34d399';
        mc.lineWidth = 22; mc.lineCap = 'round'; mc.stroke();
      }

      mc.fillStyle = 'white'; mc.font = 'bold 54px Arial';
      mc.textAlign = 'center'; mc.textBaseline = 'middle';
      mc.fillText(`${filled}`, cx, cy - 12);
      mc.font = '21px Arial'; mc.fillStyle = 'rgba(255,255,255,0.5)';
      mc.fillText(`/ ${BUCKETS} areas`, cx, cy + 26);
      mc.textBaseline = 'alphabetic';

      if (tooClose) {
        mc.fillStyle = '#f87171'; mc.font = 'bold 22px Arial';
        mc.fillText('⚠ Step back from vehicle', cx, 386);
      } else if (annotating) {
        mc.fillStyle = '#fbbf24'; mc.font = 'bold 22px Arial';
        mc.fillText('🎙 Recording... pull to save', cx, 386);
      } else if (filled >= MIN_BUCKETS_COMPLETE) {
        mc.fillStyle = '#34d399'; mc.font = 'bold 22px Arial';
        mc.fillText('✓ Pull trigger to complete scan', cx, 386);
      } else {
        mc.fillStyle = 'rgba(255,255,255,0.5)'; mc.font = '21px Arial';
        mc.fillText('Walk around the vehicle', cx, 381);
        mc.fillStyle = 'rgba(255,255,255,0.35)'; mc.font = '18px Arial';
        mc.fillText('Trigger anytime to add voice note', cx, 413);
      }
      mTex.needsUpdate = true;
    }

    function drawVoice(text) {
      vc.clearRect(0, 0, 512, 300);
      vc.fillStyle = 'rgba(15,23,42,0.93)';
      rrect(vc, 0, 0, 512, 300, 28); vc.fill();
      vc.strokeStyle = '#fbbf24'; vc.lineWidth = 2.5;
      rrect(vc, 0, 0, 512, 300, 28); vc.stroke();
      vc.fillStyle = '#fbbf24'; vc.font = '26px Arial';
      vc.textAlign = 'center'; vc.fillText('🎙 Field Note', 256, 48);
      vc.fillStyle = 'white'; vc.font = '20px Arial';
      const words = text.split(' ');
      let line = '', y = 88;
      for (const word of words) {
        const test = line + word + ' ';
        if (vc.measureText(test).width > 456 && line) {
          vc.fillText(line.trim(), 256, y); line = word + ' '; y += 30;
        } else { line = test; }
      }
      if (line) vc.fillText(line.trim(), 256, y);
      vc.fillStyle = 'rgba(255,255,255,0.4)'; vc.font = '17px Arial';
      vc.fillText('Pull trigger to save & continue', 256, 270);
      vTex.needsUpdate = true;
    }

    async function captureFrame(video, bIdx, angleDeg) {
      try {
        const w = video.videoWidth || 640, h = video.videoHeight || 480;
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        const c = off.getContext('2d');
        c.drawImage(video, 0, 0);
        const imgData = c.getImageData(0, 0, w, h);
        const sharp = computeSharpness(imgData.data);
        const blob = await new Promise(res => off.toBlob(res, 'image/jpeg', 0.88));
        if (!buckets[bIdx] || sharp > buckets[bIdx].sharpness) {
          buckets[bIdx] = { frameBlob: blob, sharpness: sharp, angle: angleDeg };
        }
      } catch (_) {}
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
      if (!SR) { drawVoice('Voice not supported.\nTap trigger to save.'); return; }
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
      return { x: lastViewerT.x + lastViewerFwd.x * dist, y: 0, z: lastViewerT.z + lastViewerFwd.z * dist };
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
        session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['hit-test', 'hand-tracking'],
        });
        sessionRef.current = session;
      } catch (e) { console.error('[ImmersiveScan] XR:', e); onExit(); return; }

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      await renderer.xr.setSession(session);
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;';

      refSpace = await session.requestReferenceSpace('local-floor');
      const viewerSpace = await session.requestReferenceSpace('viewer');
      try { hitTestSource = await session.requestHitTestSource({ space: viewerSpace }); }
      catch (e) { console.warn('[ImmersiveScan] no hit-test, using fallback placement'); }

      const scene = new THREE.Scene();
      mTex = new THREE.CanvasTexture(mCanvas);
      const mPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.55),
        new THREE.MeshBasicMaterial({ map: mTex, transparent: true, depthWrite: false })
      );
      scene.add(mPanel);
      drawSetup('Tap front bumper\non the ground');

      vTex = new THREE.CanvasTexture(vCanvas);
      vPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48, 0.28),
        new THREE.MeshBasicMaterial({ map: vTex, transparent: true, depthWrite: false })
      );
      vPanel.visible = false;
      scene.add(vPanel);

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

        mPanel.position.set(tx + fwd.x, ty - 0.15 + fwd.y, tz + fwd.z);
        mPanel.quaternion.copy(quat);

        if (vPanel.visible) {
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
          vPanel.position.set(
            tx + fwd.x * 0.95 + right.x * 0.38,
            ty - 0.05 + fwd.y * 0.95,
            tz + fwd.z * 0.95 + right.z * 0.38
          );
          vPanel.quaternion.copy(quat);
        }

        if (hitTestSource && (phase === 'setup-front' || phase === 'setup-rear')) {
          const hits = frame.getHitTestResults(hitTestSource);
          if (hits.length > 0) lastHitPoint = hits[0].getPose(refSpace).transform.position;
        }

        if (phase === 'scanning') {
          const { x: cx2, z: cz2 } = carCenter;
          const dist = Math.sqrt((tx - cx2) ** 2 + (tz - cz2) ** 2) - carLength / 2;
          tooClose = dist < MIN_DIST_FROM_EDGE;
          const azDeg = ((Math.atan2(tz - cz2, tx - cx2) * 180 / Math.PI) + 360) % 360;
          currentBucket = Math.floor(azDeg / BUCKET_DEG) % BUCKETS;

          const video = videoRef.current;
          if (!tooClose && !annotating && video?.videoWidth > 0 && time - bucketCooldowns[currentBucket] > 500) {
            bucketCooldowns[currentBucket] = time;
            captureFrame(video, currentBucket, azDeg);
          }

          if (time - lastPanelDraw > 100) { lastPanelDraw = time; drawScan(); }
        }

        renderer.render(scene, xrCam);
      });

      session.addEventListener('selectend', () => {
        if (phase === 'complete') return;

        if (phase === 'setup-front') {
          const pt = lastHitPoint ?? fallbackFloorPoint(2);
          if (pt) {
            frontPoint = { x: pt.x, y: 0, z: pt.z };
            phase = 'setup-rear';
            lastHitPoint = null;
            drawSetup('Tap rear bumper\non the ground');
          }
          return;
        }

        if (phase === 'setup-rear') {
          const pt = lastHitPoint ?? (frontPoint ? fallbackFloorPoint(4.5) : null);
          if (pt) {
            rearPoint = { x: pt.x, y: 0, z: pt.z };
            carLength = Math.max(
              Math.sqrt((rearPoint.x - frontPoint.x) ** 2 + (rearPoint.z - frontPoint.z) ** 2),
              1.5
            );
            carCenter = { x: (frontPoint.x + rearPoint.x) / 2, z: (frontPoint.z + rearPoint.z) / 2 };
            phase = 'scanning';
            drawScan();
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
            drawScan();
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
          drawScan();
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
