import { useEffect, useRef } from 'react';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';

export default function GaussianViewer({ splatUrl }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current || !splatUrl) return;

    const w = mountRef.current.clientWidth || window.innerWidth;
    const h = mountRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    camera.position.set(0, 1.5, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = 20;

    let spark;
    try {
      spark = new SparkRenderer({ renderer, paged: true });
      spark.scale.set(1, -1, 1);
      scene.add(spark);

      const butterfly = new SplatMesh({ url: splatUrl });
      butterfly.quaternion.set(1, 0, 0, 0);
      butterfly.position.set(0, 0, -3);
      scene.add(butterfly);
      console.log('[GaussianViewer] SparkRenderer created for:', splatUrl);
    } catch (e) {
      console.error('[GaussianViewer] SparkRenderer failed:', e);
    }

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      spark?.dispose?.();
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [splatUrl]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
