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

function midPoint(a, b) {
  return new THREE.Vector3((a.mid.x + b.mid.x) / 2, (a.mid.y + b.mid.y) / 2, (a.mid.z + b.mid.z) / 2);
}

function getInputPose(inputSource, frame, refSpace) {
  if (!inputSource?.targetRaySpace) return null;
  const pose = frame.getPose(inputSource.targetRaySpace, refSpace);
  if (!pose) return null;
  const p = pose.transform.position;
  const q = pose.transform.orientation;
  const origin = new THREE.Vector3(p.x, p.y, p.z);
  const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  return {
    origin,
    quat,
    direction: new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize(),
  };
}

export default function ImmersiveViewer({ splatUrl, damageData, onComplete, onExit, xrSession: providedSession }) {
  const sessionRef = useRef(null);

  useEffect(() => {
    let renderer, session, refSpace;
    let splatPlaced = false;
    let spark = null;
    let butterfly = null;
    let leftHand = null, rightHand = null;
    const prevPinch = { left: null, right: null };
    const inputPoses = new Map();
    const activeControllers = new Map();
    const controllerPair = { prevDistance: null, prevAngle: null };

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 512; pCanvas.height = 200;
    const pc = pCanvas.getContext('2d');
    let pTex;

    const exitCanvas = document.createElement('canvas');
    exitCanvas.width = 256; exitCanvas.height = 96;
    const exitCtx = exitCanvas.getContext('2d');
    let exitTex, exitBtn;

    function drawPanel(line1, line2 = '') {
      pc.clearRect(0, 0, 512, 200);
      pc.fillStyle = 'rgba(15,23,42,0.92)';
      rrect(pc, 0, 0, 512, 200, 28); pc.fill();
      pc.strokeStyle = '#1a3cef'; pc.lineWidth = 3;
      rrect(pc, 0, 0, 512, 200, 28); pc.stroke();
      pc.fillStyle = '#1a3cef'; pc.font = 'bold 22px Arial'; pc.textAlign = 'center';
      pc.fillText('3D Reconstruction', 256, 44);
      pc.fillStyle = 'white'; pc.font = '18px Arial';
      pc.fillText(line1, 256, 84);
      if (line2) { pc.fillStyle = 'rgba(255,255,255,0.55)'; pc.font = '15px Arial'; pc.fillText(line2, 256, 114); }
      pc.fillStyle = 'rgba(255,255,255,0.35)'; pc.font = '15px Arial';
      pc.fillText('Hands: left pinch move · right pinch rotate · both scale', 256, 155);
      pc.fillText('Controllers: trigger move/rotate · two triggers scale · Exit closes', 256, 178);
      pTex.needsUpdate = true;
    }

    function drawExitButton() {
      exitCtx.clearRect(0, 0, 256, 96);
      exitCtx.fillStyle = 'rgba(248,113,113,0.88)';
      rrect(exitCtx, 0, 0, 256, 96, 24); exitCtx.fill();
      exitCtx.strokeStyle = 'rgba(255,255,255,0.30)';
      exitCtx.lineWidth = 3;
      rrect(exitCtx, 0, 0, 256, 96, 24); exitCtx.stroke();
      exitCtx.fillStyle = 'white';
      exitCtx.font = 'bold 34px Arial';
      exitCtx.textAlign = 'center';
      exitCtx.fillText('Exit', 128, 60);
      exitTex.needsUpdate = true;
    }

    async function start() {
      if (providedSession) {
        session = providedSession;
        sessionRef.current = session;
      } else {
        try {
          session = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['local-floor', 'unbounded'],
            optionalFeatures: ['hand-tracking'],
          });
          sessionRef.current = session;
        } catch (e) { console.error('[ImmersiveViewer] XR session failed:', e); onExit(); return; }
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

        butterfly = new SplatMesh({ url: splatUrl });
        butterfly.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
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

      exitTex = new THREE.CanvasTexture(exitCanvas);
      exitBtn = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.0825),
        new THREE.MeshBasicMaterial({ map: exitTex, transparent: true, depthWrite: false })
      );
      scene.add(exitBtn);
      drawExitButton();

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

        if (!splatPlaced && butterfly) {
          splatPlaced = true;
          butterfly.position.set(tx + fwd.x * 2, 0, tz + fwd.z * 2);
          drawPanel('Viewing reconstruction', areaCount > 0 ? `${areaCount} damage area${areaCount !== 1 ? 's' : ''}` : '');
        }

        // Resolve hand references from input sources
        for (const src of frame.session.inputSources) {
          if (src.hand && src.handedness === 'left')  leftHand  = src.hand;
          if (src.hand && src.handedness === 'right') rightHand = src.hand;
          const pose = getInputPose(src, frame, refSpace);
          if (pose) inputPoses.set(src, pose);
        }

        if (splatPlaced && butterfly) {
          const active = [...activeControllers.entries()]
            .map(([inputSource, state]) => ({ inputSource, state, pose: getInputPose(inputSource, frame, refSpace) }))
            .filter(item => item.pose);

          if (active.length >= 2) {
            const a = active[0].pose.origin;
            const b = active[1].pose.origin;
            const midpoint = a.clone().add(b).multiplyScalar(0.5);
            butterfly.position.lerp(midpoint, 0.22);

            const distance = a.distanceTo(b);
            if (controllerPair.prevDistance && controllerPair.prevDistance > 0.001) {
              const scale = Math.max(0.2, Math.min(5, butterfly.scale.x * (distance / controllerPair.prevDistance)));
              butterfly.scale.setScalar(scale);
            }

            const angle = Math.atan2(b.x - a.x, b.z - a.z);
            if (controllerPair.prevAngle !== null) {
              butterfly.rotation.y += angle - controllerPair.prevAngle;
            }
            controllerPair.prevDistance = distance;
            controllerPair.prevAngle = angle;
          } else {
            controllerPair.prevDistance = null;
            controllerPair.prevAngle = null;
          }

          if (active.length === 1) {
            const { state, pose } = active[0];
            if (state.distance === null) {
              state.distance = Math.max(0.3, pose.origin.distanceTo(butterfly.position));
            }
            const target = pose.origin.clone().addScaledVector(pose.direction, state.distance);
            butterfly.position.lerp(target, 0.35);

            if (state.prevDirection) {
              butterfly.rotation.y += (pose.direction.x - state.prevDirection.x) * 2.5;
              butterfly.rotation.x -= (pose.direction.y - state.prevDirection.y) * 2;
            }
            state.prevDirection = pose.direction.clone();
          }
        }

        // Hand gesture interaction (only after splat placed)
        if (splatPlaced && butterfly) {
          const left  = getPinch(leftHand,  frame, refSpace);
          const right = getPinch(rightHand, frame, refSpace);

          const leftMid = left?.pinching ? new THREE.Vector3(left.mid.x, left.mid.y, left.mid.z) : null;
          const rightMid = right?.pinching ? new THREE.Vector3(right.mid.x, right.mid.y, right.mid.z) : null;
          if ((leftMid && exitBtn && leftMid.distanceTo(exitBtn.position) < 0.13) ||
              (rightMid && exitBtn && rightMid.distanceTo(exitBtn.position) < 0.13)) {
            session.end().catch(() => {});
            return;
          }

          if (left?.pinching && right?.pinching) {
            // Both hands pinching scales the reconstruction.
            if (prevPinch.left && prevPinch.right) {
              const prev = midDist(prevPinch.left, prevPinch.right);
              const curr = midDist(left, right);
              if (prev > 0.001) {
                const ratio = curr / prev;
                const s = Math.max(0.2, Math.min(5, butterfly.scale.x * ratio));
                butterfly.scale.setScalar(s);
              }
            }
            const midpoint = midPoint(left, right);
            butterfly.position.lerp(midpoint, 0.12);
          } else {
            if (left?.pinching && prevPinch.left) {
              // Left hand pinch moves the reconstruction.
              const dx = left.mid.x - prevPinch.left.mid.x;
              const dy = left.mid.y - prevPinch.left.mid.y;
              const dz = left.mid.z - prevPinch.left.mid.z;
              butterfly.position.x += dx;
              butterfly.position.y += dy;
              butterfly.position.z += dz;
            } else if (right?.pinching && prevPinch.right) {
              // Right hand pinch rotates the reconstruction.
              const dx = right.mid.x - prevPinch.right.mid.x;
              const dy = right.mid.y - prevPinch.right.mid.y;
              butterfly.rotation.y += dx * 8;
              butterfly.rotation.x += dy * 4;
            }
          }

          prevPinch.left  = left?.pinching  ? left  : null;
          prevPinch.right = right?.pinching ? right : null;
        }

        // Head-lock panel
        panel.position.set(tx + fwd.x * 0.9, ty + 0.1 + fwd.y * 0.9, tz + fwd.z * 0.9);
        panel.quaternion.copy(quat);

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
        exitBtn.position.set(
          tx + fwd.x * 0.9 + right.x * 0.41,
          ty + 0.21 + fwd.y * 0.9,
          tz + fwd.z * 0.9 + right.z * 0.41
        );
        exitBtn.quaternion.copy(quat);

        renderer.render(scene, camera);
      });

      session.addEventListener('selectstart', event => {
        if (event.inputSource.hand) return;
        const pose = inputPoses.get(event.inputSource);
        if (pose && exitBtn) {
          const hits = new THREE.Raycaster(pose.origin, pose.direction).intersectObject(exitBtn);
          if (hits.length) {
            session.end().catch(() => {});
            return;
          }
        }
        activeControllers.set(event.inputSource, { distance: null, prevDirection: null });
      });

      session.addEventListener('selectend', event => {
        activeControllers.delete(event.inputSource);
        if (activeControllers.size < 2) {
          controllerPair.prevDistance = null;
          controllerPair.prevAngle = null;
        }
      });

      session.addEventListener('end', () => {
        renderer.setAnimationLoop(null);
        spark?.dispose?.();
        butterfly?.dispose?.();
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
