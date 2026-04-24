// Scenes 1-3: login + OCR document scan + policy verification
import { useState } from 'react';
import OcrCapture from '../components/OcrCapture';
import ClaimHUD from '../components/ClaimHUD';
import { enableXRLayer } from '../lib/enableXRLayer';

export default function LoginScene({ onLogin }) {
  const [step, setStep] = useState('login'); // login | ocr | done
  const [claimId, setClaimId] = useState('CLM-2024-8821');
  const [adjuster, setAdjuster] = useState('Agent Rivera');
  const [ocrFields, setOcrFields] = useState({});

  function handleOcrComplete(fields) {
    setOcrFields(fields);
    setStep('done');
  }

  if (step === 'ocr') return <OcrCapture onComplete={handleOcrComplete} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial' }}>
      <div style={{
        width: 360, padding: 32,
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)',
        borderRadius: 20, border: '1px solid rgba(13,148,136,0.3)', color: 'white',
        ...enableXRLayer({ zOffset: 0.3 })
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Coverage Ghost</div>
        <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 24 }}>Insurance Field Companion</div>
        <label style={{ fontSize: 12, opacity: 0.7 }}>Claim ID</label>
        <input value={claimId} onChange={e => setClaimId(e.target.value)}
          style={{ width: '100%', marginTop: 4, marginBottom: 16, padding: '8px 12px',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, color: 'white', fontSize: 14, boxSizing: 'border-box' }} />
        <label style={{ fontSize: 12, opacity: 0.7 }}>Adjuster Name</label>
        <input value={adjuster} onChange={e => setAdjuster(e.target.value)}
          style={{ width: '100%', marginTop: 4, marginBottom: 16, padding: '8px 12px',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, color: 'white', fontSize: 14, boxSizing: 'border-box' }} />
        {step === 'done' && ocrFields.name && (
          <div style={{ background: 'rgba(13,148,136,0.15)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#99f6e4', marginBottom: 4 }}>OCR auto-filled</div>
            <div style={{ fontSize: 13 }}>{ocrFields.name} — {ocrFields.policy_number}</div>
          </div>
        )}
        {step === 'login' && (
          <button onClick={() => setStep('ocr')}
            style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'white',
              fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
            Scan documents (OCR)
          </button>
        )}
        <button onClick={() => onLogin({ claimId, adjuster, ocrFields })}
          style={{ width: '100%', padding: '12px', background: '#0d9488',
            border: 'none', borderRadius: 10, color: 'white', fontSize: 15,
            fontWeight: 700, cursor: 'pointer' }}>
          Open Claim
        </button>
      </div>
    </div>
  );
}
