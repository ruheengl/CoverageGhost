import { useEffect, useRef } from 'react';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';

export default function ImmersiveViewer({ splatUrl, damageData, onComplete, onExit }) {
  const sessionRef = useRef(null);

  useEffect(() => {
    let renderer, session, refSpace;
    let splatPlaced = false;

    console.log('[ImmersiveViewer] splatUrl:', splatUrl);

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 512; pCanvas.height = 200;
    const pc = pCanvas.getContext('2d');
    let pTex;

    function drawPanel(line1, line2 = '') {
      pc.clearRect(0, 0, 512, 200);
      pc.fillStyle = 'rgba(22,24,30,0.92)';
      rrect(pc, 0, 0, 512, 200, 28); pc.fill();
      pc.strokeStyle = 'rgba(255,255,255,0.1)'; pc.lineWidth = 2;
      rrect(pc, 0, 0, 512, 200, 28); pc.stroke();
      pc.fillStyle = 'rgba(255,255,255,0.45)'; pc.font = '13px Arial'; pc.textAlign = 'center';
      pc.fillText('3D RECONSTRUCTION', 256, 38);
      pc.fillStyle = 'white'; pc.font = 'bold 20px Arial';
      pc.fillText(line1, 256, 78);
      if (line2) { pc.fillStyle = 'rgba(255,255,255,0.5)'; pc.font = '15px Arial'; pc.fillText(line2, 256, 108); }
      pc.fillStyle = 'rgba(255,255,255,0.3)'; pc.font = '14px Arial';
      pc.fillText('Pull trigger to continue', 256, 168);
      pTex.needsUpdate = true;
    }

    async function start() {
      try {
        session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local-floor', 'unbounded'],
          optionalFeatures: ['hand-tracking'],
        });
        sessionRef.current = session;
      } catch (e) {
        console.error('[ImmersiveViewer] XR session failed:', e);
        onExit();
        return;
      }

      // antialias: false — MSAA framebuffers are incompatible with WebXR framebuffer on Meta Quest
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;';

      refSpace = renderer.xr.getReferenceSpace();

      const scene = new THREE.Scene();

      // SparkRenderer — loads the .spz file with streaming LoD
      let spark;
      try {
        spark = new SparkRenderer({ renderer, url: splatUrl, paged: true });
        scene.add(spark);

        const butterfly = new SplatMesh({ url: splatUrl });
        butterfly.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        butterfly.position.set(0, 0, -3);
        scene.add(butterfly);
        console.log('[ImmersiveViewer] SparkRenderer created for:', splatUrl);
      } catch (e) {
        console.error('[ImmersiveViewer] SparkRenderer failed:', e);
      }

      // Head-locked info panel
      pTex = new THREE.CanvasTexture(pCanvas);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.195),
        new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false })
      );
      scene.add(panel);
      const areaCount = damageData?.affected_areas?.length ?? damageData?.damaged_areas?.length ?? 0;
      drawPanel('Loading splat...', areaCount > 0 ? `${areaCount} damage area${areaCount !== 1 ? 's' : ''} detected` : '');

      const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);

      // Use renderer.setAnimationLoop — the Three.js XR-aware loop that keeps all
      // WebGL operations inside a valid XR frame, preventing "invalidated object" errors.
      renderer.setAnimationLoop((time, frame) => {
        if (!frame) return;

        const vp = frame.getViewerPose(refSpace);
        if (!vp) { renderer.render(scene, camera); return; }

        const { x: tx, y: ty, z: tz } = vp.transform.position;
        const q = vp.transform.orientation;
        const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

        // Place splat once — 2m in front at floor level
        if (!splatPlaced && spark) {
          splatPlaced = true;
          spark.position.set(tx + fwd.x * 2, 0, tz + fwd.z * 2);
          console.log('[ImmersiveViewer] splat placed at', spark.position);
          drawPanel('Viewing reconstruction', areaCount > 0 ? `${areaCount} damage area${areaCount !== 1 ? 's' : ''}` : '');
        }

        // Head-lock panel
        panel.position.set(tx + fwd.x * 0.9, ty + 0.1 + fwd.y * 0.9, tz + fwd.z * 0.9);
        panel.quaternion.copy(quat);

        renderer.render(scene, camera);
      });

      session.addEventListener('selectend', () => {
        session.end().catch(() => {});
      });

      session.addEventListener('end', () => {
        renderer.setAnimationLoop(null);
        spark?.dispose?.();
        renderer.dispose();
        renderer.domElement.remove();
        onExit();
        onComplete();
      });
    }

    start();
    return () => { sessionRef.current?.end().catch(() => {}); };
  }, []);

  return null;
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
