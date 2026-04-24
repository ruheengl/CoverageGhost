import { useState } from 'react';
import CameraCapture from './CameraCapture';
import { enableXRLayer } from '../lib/enableXRLayer';
import { ocrDocument, imageToBase64 } from '../lib/api';

export default function OcrCapture({ onComplete }) {
  const [scanning, setScanning] = useState(false);
  const [fields, setFields] = useState({});
  const [done, setDone] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [ocrError, setOcrError] = useState(null);

  async function handleScan(file) {
    if (!file) return;
    setOcrError(null);

    // Show the image being sent
    const reader = new FileReader();
    reader.onload = (e) => setCapturedDataUrl(e.target.result);
    reader.readAsDataURL(file);

    setScanning(true);
    try {
      const b64 = await imageToBase64(file);
      const result = await ocrDocument(b64, 'drivers_license');
      setFields(result.extracted_fields || {});
      setDone(true);
    } catch (err) {
      console.error('OCR failed:', err);
      setOcrError(err.message || 'OCR request failed');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div
      style={{
        width: 340,
        padding: 24,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid rgba(13,148,136,0.3)',
        color: 'white',
        fontFamily: 'Arial',
        ...enableXRLayer({ zOffset: 0.3 }),
      }}
    >
      {capturedDataUrl && !done && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase' }}>
            Image sent to OCR
          </div>
          <img
            src={capturedDataUrl}
            alt="OCR preview"
            style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', display: 'block' }}
          />
          {ocrError && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>
              Error: {ocrError}
            </div>
          )}
        </div>
      )}
      {!done ? (
        <CameraCapture
          title="Scan Documents"
          subtitle="Capture a document with the live camera, or choose a saved image."
          captureLabel="Capture Document"
          busyLabel={scanning ? 'Scanning...' : 'Capture Document'}
          onCapture={handleScan}
        />
      ) : (
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            Scan Documents
          </div>
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 20 }}>
            Driver&apos;s license, insurance card, vehicle registration
          </div>
          {Object.entries(fields).map(([key, val]) => val && (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase' }}>
                {key.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
          <button
            onClick={() => onComplete(fields)}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '12px',
              background: '#0d9488',
              border: 'none',
              borderRadius: 10,
              color: 'white',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Confirm and continue
          </button>
        </div>
      )}
    </div>
  );
}
