import { useRef, useState, useEffect } from 'react';

export default function CameraCapture({
  title = 'Camera',
  subtitle = 'Capture a document or upload a photo.',
  captureLabel = 'Take Photo',
  busyLabel = 'Processing...',
  onCapture,
  style = {},
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const uploadInputRef = useRef(null);
  const streamRef = useRef(null);

  const [mode, setMode] = useState('idle'); // idle | camera | processing
  const [previewReady, setPreviewReady] = useState(false);
  const [error, setError] = useState('');

  // Wire stream to video element after it mounts
  useEffect(() => {
    if (mode !== 'camera' || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;

    const attach = async () => {
      await Promise.race([
        new Promise((resolve) => video.addEventListener('loadedmetadata', resolve, { once: true })),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      try {
        await video.play();
        setPreviewReady(true);
      } catch (err) {
        console.warn('[CameraCapture] play() failed:', err.message);
        // Stream still usable for canvas capture even if preview fails
      }
    };

    attach();
  }, [mode]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => stopStream();
  }, []);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function openCamera() {
    setError('');
    setPreviewReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available in this browser. Use Upload Photo.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode('camera'); // triggers useEffect to wire srcObject after render
    } catch (err) {
      console.warn('[CameraCapture] getUserMedia failed:', err.name, err.message);
      setError('Camera permission denied. Use Upload Photo instead.');
    }
  }

  function cancelCamera() {
    stopStream();
    setPreviewReady(false);
    setMode('idle');
  }

  function handleTakePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);

    canvas.toBlob(async (blob) => {
      if (!blob) { cancelCamera(); return; }
      cancelCamera();
      setMode('processing');
      try {
        await onCapture(blob);
      } catch (err) {
        setError(err.message || 'Processing failed.');
        setMode('idle');
      }
    }, 'image/jpeg', 0.92);
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError('');
    setMode('processing');
    try {
      await onCapture(file);
    } catch (err) {
      setError(err.message || 'Processing failed.');
      setMode('idle');
    }
  }

  const btn = (onClick, label, primary = false, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{
      flex: 1, padding: '13px 10px',
      border: primary ? 'none' : '1px solid rgba(255,255,255,0.18)',
      borderRadius: 10,
      background: disabled ? '#334155' : primary ? '#0d9488' : 'rgba(255,255,255,0.06)',
      color: 'white', fontWeight: primary ? 700 : 600, fontSize: 14,
      cursor: disabled ? 'default' : 'pointer',
    }}>
      {label}
    </button>
  );

  return (
    <div style={{
      width: 360, padding: 20,
      background: 'rgba(15,23,42,0.88)', borderRadius: 18,
      border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(18px)',
      color: 'white', fontFamily: 'Arial',
      ...style,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.68, marginBottom: 16 }}>{subtitle}</div>

      {/* Live camera viewport */}
      {mode === 'camera' && (
        <div style={{
          borderRadius: 14, overflow: 'hidden', background: '#020617',
          border: '1px solid rgba(255,255,255,0.1)',
          height: 240, position: 'relative', marginBottom: 14,
        }}>
          <video
            ref={videoRef}
            playsInline muted autoPlay disablePictureInPicture
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {!previewReady && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'rgba(255,255,255,0.75)',
              background: 'rgba(2,6,23,0.7)', textAlign: 'center', padding: 16,
            }}>
              Starting camera...
            </div>
          )}
        </div>
      )}

      {mode === 'processing' && (
        <div style={{
          height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, opacity: 0.7, marginBottom: 14,
        }}>
          {busyLabel}
        </div>
      )}

      {error && <div style={{ marginBottom: 12, fontSize: 12, color: '#fca5a5' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        {mode === 'idle' && (
          <>
            {btn(openCamera, 'Open Camera', true)}
            {btn(() => uploadInputRef.current?.click(), 'Upload Photo')}
          </>
        )}
        {mode === 'camera' && (
          <>
            {btn(handleTakePhoto, captureLabel, true)}
            {btn(cancelCamera, 'Cancel')}
          </>
        )}
        {mode === 'processing' && btn(null, busyLabel, true, true)}
      </div>

      <input ref={uploadInputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleUpload} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
