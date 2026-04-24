// Scene 3: Agent scans driver's license, insurance card, vehicle registration
// Claude Vision extracts fields → form auto-fills
import { useState, useRef } from 'react';
import { enableXRLayer } from '@webspatial/react-sdk';
import { ocrDocument, imageToBase64 } from '../lib/api';

export default function OcrCapture({ onComplete }) {
  const [scanning, setScanning] = useState(false);
  const [fields, setFields] = useState({});
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  async function handleScan(e) {
    const file = e.target.files[0];
    if (!file) return;
    setScanning(true);
    try {
      const b64 = await imageToBase64(file);
      const result = await ocrDocument(b64, 'drivers_license');
      setFields(result.extracted_fields || {});
      setDone(true);
    } catch (err) {
      console.error('OCR failed:', err);
    } finally { setScanning(false); }
  }

  return (
    <div style={{
      width: 340, padding: 24,
      background: 'rgba(15,23,42,0.85)',
      backdropFilter: 'blur(20px)',
      borderRadius: 16,
      border: '1px solid rgba(13,148,136,0.3)',
      color: 'white', fontFamily: 'Arial',
      ...enableXRLayer({ zOffset: 0.3 })
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Scan Documents
      </div>
      <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 20 }}>
        Driver's license, insurance card, vehicle registration
      </div>

      {!done ? (
        <button onClick={() => fileRef.current?.click()}
          disabled={scanning}
          style={{ width: '100%', padding: '12px',
            background: scanning ? '#374151' : '#0d9488',
            border: 'none', borderRadius: 10, color: 'white',
            fontSize: 15, fontWeight: 700, cursor: scanning ? 'default' : 'pointer' }}>
          {scanning ? 'Scanning...' : 'Point camera at document'}
        </button>
      ) : (
        <div>
          {Object.entries(fields).map(([key, val]) => val && (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase' }}>{key.replace(/_/g,' ')}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{val}</div>
            </div>
          ))}
          <button onClick={() => onComplete(fields)}
            style={{ width: '100%', marginTop: 16, padding: '12px',
              background: '#0d9488', border: 'none', borderRadius: 10,
              color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Confirm and continue
          </button>
        </div>
      )}
      <input ref={fileRef} type='file' accept='image/*'
        style={{ display: 'none' }} onChange={handleScan} />
    </div>
  );
}
