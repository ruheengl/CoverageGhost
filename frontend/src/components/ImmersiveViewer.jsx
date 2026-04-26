import { useEffect, useRef } from 'react';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';

function getPinch(hand, frame, refSpace) {
  if (!hand) return null;
  const i = hand.get('index-finger-tip');
  const t = hand.get('thumb-tip');
  if (!i || !t) return null;
  const ip = frame.getJointPose(i, refSpace);
  const tp = frame.getJointPose(t, refSpace);
  if (!ip || !tp) return null;
  const p = ip.transform.position, q = tp.transform.position;
  const dist = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  return { pinching: dist < 0.03, mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 } };
}

function midDist(a, b) {
  return Math.hypot(a.mid.x - b.mid.x, a.mid.y - b.mid.y, a.mid.z - b.mid.z);
}

export default function ImmersiveViewer({ splatUrl, damageData, onComplete, onExit }) {
  const sessionRef = useRef(null);

  useEffect(() => {
    let renderer, session, refSpace;
    let splatPlaced = false;
    let spark = null;
    let leftHand = null, rightHand = null;
    const prevPinch = { left: null, right: null };

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 512; pCanvas.height = 200;
    const pc = pCanvas.getContext('2d');
    let pTex;

    function drawPanel(line1, line2 = '') {
      pc.clearRect(0, 0, 512, 200);
      pc.fillStyle = 'rgba(15,23,42,0.92)';
      rrect(pc, 0, 0, 512, 200, 28); pc.fill();
      pc.strokeStyle = '#0d9488'; pc.lineWidth = 3;
      rrect(pc, 0, 0, 512, 200, 28); pc.stroke();
      pc.fillStyle = '#99f6e4'; pc.font = 'bold 22px Arial'; pc.textAlign = 'center';
      pc.fillText('3D Reconstruction', 256, 44);
      pc.fillStyle = 'white'; pc.font = '18px Arial';
      pc.fillText(line1, 256, 84);
      if (line2) { pc.fillStyle = 'rgba(255,255,255,0.55)'; pc.font = '15px Arial'; pc.fillText(line2, 256, 114); }
      pc.fillStyle = 'rgba(255,255,255,0.35)'; pc.font = '15px Arial';
      pc.fillText('Pinch & drag to rotate  |  Both hands to scale', 256, 155);
      pc.fillText('Pull trigger to continue', 256, 178);
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

      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      document.body.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;';

      refSpace = renderer.xr.getReferenceSpace();

      const scene = new THREE.Scene();

      try {
        spark = new SparkRenderer({ renderer, paged: true });
        scene.add(spark);

        const butterfly = new SplatMesh({ url: splatUrl });
        butterfly.quaternion.set(1, 0, 0, 0);
        butterfly.position.set(0, 0, -3);
        scene.add(butterfly);
        console.log('[ImmersiveViewer] SparkRenderer created for:', splatUrl);
      } catch (e) {
        console.error('[ImmersiveViewer] SparkRenderer failed:', e);
      }

      pTex = new THREE.CanvasTexture(pCanvas);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.23),
        new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthWrite: false })
      );
      scene.add(panel);

      const areaCount = damageData?.affected_areas?.length ?? damageData?.damaged_areas?.length ?? 0;
      drawPanel('Loading splat...', areaCount > 0 ? `${areaCount} damage area${areaCount !== 1 ? 's' : ''} detected` : '');

      const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 100);

      renderer.setAnimationLoop((time, frame) => {
        if (!frame) return;

        const vp = frame.getViewerPose(refSpace);
        if (!vp) { renderer.render(scene, camera); return; }

        const { x: tx, y: ty, z: tz } = vp.transform.position;
        const q = vp.transform.orientation;
        const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

        if (!splatPlaced && spark) {
          splatPlaced = true;
          spark.position.set(tx + fwd.x * 2, 0, tz + fwd.z * 2);
          drawPanel('Viewing reconstruction', areaCount > 0 ? `${areaCount} damage area${areaCount !== 1 ? 's' : ''}` : '');
        }

        // Resolve hand references from input sources
        for (const src of frame.session.inputSources) {
          if (src.hand && src.handedness === 'left')  leftHand  = src.hand;
          if (src.hand && src.handedness === 'right') rightHand = src.hand;
        }

        // Hand gesture interaction (only after splat placed)
        if (splatPlaced && spark) {
          const left  = getPinch(leftHand,  frame, refSpace);
          const right = getPinch(rightHand, frame, refSpace);

          if (left?.pinching && right?.pinching && prevPinch.left && prevPinch.right) {
            // Two-hand pinch → scale
            const prev = midDist(prevPinch.left, prevPinch.right);
            const curr = midDist(left, right);
            if (prev > 0.001) {
              const ratio = curr / prev;
              const s = Math.max(0.2, Math.min(5, spark.scale.x * ratio));
              spark.scale.set(s, -s, s);
            }
          } else if (left?.pinching && prevPinch.left) {
            // Single left-hand pinch → rotate Y
            const dx = left.mid.x - prevPinch.left.mid.x;
            spark.rotation.y += dx * 8;
          }

          prevPinch.left  = left?.pinching  ? left  : null;
          prevPinch.right = right?.pinching ? right : null;
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
