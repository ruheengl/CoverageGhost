// Three.js wireframe overlay — colors driven by Claude coverage decisions
// MUST be embedded inside WebSpatial 3D container — never standalone
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { getColor } from '../lib/coverageColors';

// coverageMap = { 'rear bumper': 'red', 'frame': 'green', ... }
// From Claude coverage_decisions[].color field
export default function CoverageOverlay({ glbUrl, coverageMap }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current || !glbUrl) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60,
      mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 1.5, 4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    const loader = new GLTFLoader();
    loader.load(glbUrl, (gltf) => {
      const model = gltf.scene;
      scene.add(model);
      model.traverse((child) => {
        if (!child.isMesh) return;
        const meshName = child.name.toLowerCase();
        let colorKey = 'gray';
        for (const [areaName, aKey] of Object.entries(coverageMap)) {
          if (meshName.includes(areaName.toLowerCase())) { colorKey = aKey; break; }
        }
        const { hex, opacity } = getColor(colorKey);
        const color = new THREE.Color(hex);
        child.material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: opacity * 0.3 });
        const wireMesh = new THREE.Mesh(child.geometry,
          new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity }));
        child.add(wireMesh);
      });
    });

    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(animId); renderer.dispose(); };
  }, [glbUrl, coverageMap]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
