import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Renders a head-locked capture button in a WebXR immersive-ar session.
// Used on Meta Quest 3 / PICO 4 where color passthrough is available.
// The user sees the real world and a floating "Tap to Capture" button.
export default function ImmersiveScan({ onCapture, onExit }) {
  const videoRef = useRef(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    let renderer, session, refSpace, animId;
    let capturing = false;

    async function start() {
      // Start camera stream in background for capture
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (e) {
        console.warn('[ImmersiveScan] getUserMedia failed:', e.message);
      }

      // Request immersive-ar session
      try {
        session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['hand-tracking'],
        });
        sessionRef.current = session;
      } catch (e) {
        console.error('[ImmersiveScan] XR session failed:', e.message);
        onExit();
        return;
      }

      // Three.js setup
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      await renderer.xr.setSession(session);
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;';

      refSpace = await session.requestReferenceSpace('local-floor');

      // Build floating capture button panel
      const scene = new THREE.Scene();
      const btnCanvas = document.createElement('canvas');
      btnCanvas.width = 512;
      btnCanvas.height = 256;
      const ctx = btnCanvas.getContext('2d');

      function drawButton(label, color = '#0d9488') {
        ctx.clearRect(0, 0, 512, 256);
        ctx.fillStyle = 'rgba(15,23,42,0.88)';
        roundRect(ctx, 0, 0, 512, 256, 40);
        ctx.fill();
        ctx.fillStyle = color;
        roundRect(ctx, 40, 60, 432, 136, 28);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 52px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 256, 128);
        btnTex.needsUpdate = true;
      }

      const btnTex = new THREE.CanvasTexture(btnCanvas);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.25),
        new THREE.MeshBasicMaterial({ map: btnTex, transparent: true, depthWrite: false })
      );
      scene.add(panel);
      drawButton('Tap to Capture');

      // XR input — listen for controller trigger
      session.addEventListener('selectend', async () => {
        if (capturing) return;
        capturing = true;
        drawButton('Processing...', '#334155');

        try {
          const video = videoRef.current;
          const offscreen = document.createElement('canvas');
          offscreen.width = video.videoWidth || 1280;
          offscreen.height = video.videoHeight || 720;
          offscreen.getContext('2d').drawImage(video, 0, 0);
          const blob = await new Promise((res) => offscreen.toBlob(res, 'image/jpeg', 0.92));
          await onCapture(blob);
        } catch (e) {
          console.error('[ImmersiveScan] capture failed:', e);
          capturing = false;
          drawButton('Tap to Capture');
        }
      });

      // XR render loop — head-lock the panel each frame
      const xrCamera = new THREE.PerspectiveCamera();
      session.requestAnimationFrame(function loop(time, frame) {
        animId = session.requestAnimationFrame(loop);
        const pose = frame.getViewerPose(refSpace);
        if (pose) {
          const t = pose.transform.position;
          const q = pose.transform.orientation;
          // Direction vector: 1.2m forward from viewer, 0.3m below eye
          const forward = new THREE.Vector3(0, 0, -1.2).applyQuaternion(
            new THREE.Quaternion(q.x, q.y, q.z, q.w)
          );
          panel.position.set(t.x + forward.x, t.y - 0.3 + forward.y, t.z + forward.z);
          panel.quaternion.set(q.x, q.y, q.z, q.w);
        }
        renderer.render(scene, xrCamera);
      });

      session.addEventListener('end', () => {
        cancelAnimationFrame(animId);
        renderer.dispose();
        renderer.domElement.remove();
        stream?.getTracks().forEach((t) => t.stop());
        onExit();
      });
    }

    start();

    return () => {
      sessionRef.current?.end().catch(() => {});
    };
  }, []);

  return (
    // Hidden video element used as camera source for canvas capture
    <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
