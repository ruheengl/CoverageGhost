import { useEffect, useRef } from 'react';
import { SparkRenderer } from '@sparkjsdev/spark';
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

    // SparkRenderer is a THREE.Mesh — add to scene and it renders via Three.js normally.
    // paged: true enables streaming LoD for large .spz files.
    const spark = new SparkRenderer({ renderer, url: splatUrl, paged: true });
    scene.add(spark);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      spark.dispose?.();
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [splatUrl]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}
