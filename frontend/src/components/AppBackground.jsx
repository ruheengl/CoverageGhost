// // Full-screen background image — uses the hero.png asset already in the project
// // or falls back to a CSS-rendered dark industrial look
// import hero from '../assets/hero.png';

// export default function AppBackground() {
//   return (
//     <div style={{
//       position: 'fixed', inset: 0, zIndex: 0,
//       backgroundImage: `url(${hero})`,
//       backgroundSize: 'cover',
//       backgroundPosition: 'center',
//       backgroundRepeat: 'no-repeat',
//     }}>
//       {/* Subtle darkening overlay so panels read clearly */}
//       <div style={{
//         position: 'absolute', inset: 0,
//         background: 'rgba(0,0,0,0.18)',
//       }} />
//     </div>
//   );
// }

import { useEffect, useRef } from 'react';

export default function AppBackground({ active }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
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