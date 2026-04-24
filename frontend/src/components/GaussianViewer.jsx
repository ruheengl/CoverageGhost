// Spark 2.0 renderer — loads .spz with streaming LoD
// MUST be inside WebSpatial 3D container — never standalone
import { useEffect, useRef } from 'react';
import { SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';

export default function GaussianViewer({ splatUrl }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current || !splatUrl) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60,
      mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 1.5, 4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    const splat = new SplatMesh({ url: splatUrl });
    scene.add(splat);

    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(animId); renderer.dispose(); };
  }, [splatUrl]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
