import { useEffect, useRef } from 'react';

export default function CameraBackground({ active }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('[CameraBackground] getUserMedia not available on this platform');
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(e => console.warn('[CameraBackground] camera unavailable:', e));
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [active]);

  if (!active) return null;
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
    />
  );
}
