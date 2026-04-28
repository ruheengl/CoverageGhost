import { useState, useRef, useEffect } from 'react';
import SideNav from '../components/SideNav';
import PolicyCitation from '../components/PolicyCitation';
import ClaimHUD from '../components/ClaimHUD';
import CameraCapture from '../components/CameraCapture';
import ImmersiveScan from '../components/ImmersiveScan';
import { enableXRLayer } from '../lib/enableXRLayer';
import { analyzeDamage, checkCoverage, imageToBase64 } from '../lib/api';

const inWebSpatial = /WebSpatial\//.test(navigator.userAgent);
const SPLAT_URL = '/api/splat';
const ANIM_MS = 6000;
const SPIN = ['◐', '◓', '◑', '◒'];

const CARD = {
  background: 'rgba(30,30,40,0.85)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  padding: 28,
  width: 480,
};

const DIVIDER = { height: 1, background: 'rgba(255,255,255,0.10)', margin: '16px 0' };

const STATUS_COLORS = { green: '#34d399', red: '#f87171', amber: '#fbbf24', gray: '#94a3b8' };

// ─── Sub-screens ───────────────────────────────────────────────────────────────

function TaskCard({ onStart, onDismiss }) {
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
        <div>
          <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>New Task Assigned</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>20 mins ago · From HQ</div>
        </div>
      </div>
      <div style={DIVIDER} />
      {[
        ['Case ID', 'CLM-2024-8821'],
        ['Vehicle', '2021 Toyota Camry'],
        ['Claimant', 'James Chen'],
        ['Location', 'I-95 N, Houston TX'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>{value}</span>
        </div>
      ))}
      <div style={DIVIDER} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary spatial-btn" onClick={onDismiss} style={{ flex: 1 }}>Dismiss</button>
        <button className="btn-primary spatial-btn" onClick={onStart} style={{ flex: 1 }}>Start Inspection</button>
      </div>
    </div>
  );
}

function UIQTokenScreen({ onVerify }) {
  const [token, setToken] = useState('');
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 4 }}>UIQ Token</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
        Enter the unique inspection token provided by HQ for this claim.
      </div>
      <div style={DIVIDER} />
      <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, display: 'block' }}>Token number</label>
      <input
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="UIQ-_____-___"
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 10,
          background: 'rgba(240,241,245,0.95)', fontSize: 14,
          color: '#1a1a2e', marginBottom: 20, fontFamily: 'monospace', boxSizing: 'border-box',
        }}
      />
      <button className="btn-primary spatial-btn" onClick={() => onVerify(token)} style={{ borderRadius: 12, width: '100%' }}>
        Verify Token
      </button>
    </div>
  );
}

function DriverDetailsChoice({ onManual, onScan }) {
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Driver Details</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
        How would you like to input the driver&apos;s details?
      </div>
      <div style={DIVIDER} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary spatial-btn" onClick={onManual} style={{ flex: 1 }}>Enter Manually</button>
        <button className="btn-primary spatial-btn" onClick={onScan} style={{ flex: 1 }}>Scan Document</button>
      </div>
    </div>
  );
}

function ScanLicenseScreen({ onCapture, onManual }) {
  return (
    <div className="fade-up" style={{ width: 480 }}>
      <CameraCapture
        title="Scan Driver's License"
        subtitle="Point the camera at the license or upload a photo."
        captureLabel="Capture License"
        busyLabel="Reading license..."
        onCapture={async (file) => { await Promise.resolve(); onCapture(file); }}
        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(30,30,40,0.70)' }}
      />
      <button
        onClick={onManual}
        style={{
          marginTop: 10, width: '100%', padding: '11px',
          background: 'rgba(30,30,40,0.70)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, color: 'rgba(255,255,255,0.55)', fontSize: 14, cursor: 'pointer',
          backdropFilter: 'blur(12px)',
        }}
      >
        Enter Manually Instead
      </button>
    </div>
  );
}

function DriverDetailsResult({ driver, onCapturePhoto, onManual }) {
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 16 }}>Driver Details</div>
      <div style={DIVIDER} />
      {[
        ['Name', driver.name || 'James Chen'],
        ['Age', driver.age || '37 Years'],
        ['License No.', driver.license || '5463-78-7214'],
        ['Address', driver.address || '1424 S Jentilly Ln, Tempe AZ'],
        ['Valid Until', driver.validity || 'June 28, 2030'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 11 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 14, fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
        </div>
      ))}
      <div style={DIVIDER} />
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12 }}>
        A photo of the driver is required to complete verification.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary spatial-btn" onClick={onManual} style={{ flex: 1 }}>Edit Details</button>
        <button className="btn-primary spatial-btn" onClick={onCapturePhoto} style={{ flex: 1 }}>Capture Photo</button>
      </div>
    </div>
  );
}

function CapturePhotoScreen({ onCapture, onBack }) {
  return (
    <div className="fade-up" style={{ width: 480 }}>
      <CameraCapture
        title="Driver Photo"
        subtitle="Take a photo of the driver for identity verification."
        captureLabel="Capture Photo"
        busyLabel="Processing photo..."
        onCapture={async (file) => { await Promise.resolve(); onCapture(file); }}
        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(30,30,40,0.70)' }}
      />
      <button
        onClick={onBack}
        style={{
          marginTop: 10, width: '100%', padding: '11px',
          background: 'rgba(30,30,40,0.70)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12, color: 'rgba(255,255,255,0.55)', fontSize: 14, cursor: 'pointer',
          backdropFilter: 'blur(12px)',
        }}
      >
        Back
      </button>
    </div>
  );
}

// ─── Damage Scan ──────────────────────────────────────────────────────────────

function DamageScanScreen({ claim, onComplete }) {
  const [stage, setStage] = useState('idle');
  const [coverageDecisions, setCoverageDecisions] = useState([]);
  const [damageData, setDamageData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [xrSupported, setXrSupported] = useState(false);
  const [immersiveActive, setImmersiveActive] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [spinIdx, setSpinIdx] = useState(0);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    if (!inWebSpatial) {
      navigator.xr?.isSessionSupported('immersive-ar').then(setXrSupported).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (stage !== 'generating') return;
    const t = setInterval(() => setSpinIdx(i => (i + 1) % 4), 220);
    return () => clearInterval(t);
  }, [stage]);

  async function handlePhotoScan(file) {
    if (!file) return;
    setScanError('');
    setStage('scanning');
    let p = 0;
    const timer = setInterval(() => { p += 2; setProgress(Math.min(p, 95)); if (p >= 95) clearInterval(timer); }, 160);
    try {
      const b64 = await imageToBase64(file);
      const damage = await analyzeDamage(b64);
      setDamageData(damage);
      const result = await checkCoverage(damage);
      setCoverageDecisions(result.coverage_decisions || []);
      clearInterval(timer); setProgress(100); setStage('coverage');
    } catch (err) {
      console.error(err);
      clearInterval(timer);
      setScanError('Analysis failed. Check your connection and try again.');
      setStage('idle');
    }
  }

  async function handleImmersiveScan(frames, notes) {
    setVoiceNotes(notes);
    setImmersiveActive(false);
    setStage('generating');
    setProgress(0);
    const startTime = Date.now();
    const animTimer = setInterval(() => {
      setProgress(Math.min(Math.round(((Date.now() - startTime) / ANIM_MS) * 100), 99));
    }, 150);
    try {
      const firstFrame = frames.find(f => f?.frameBlob);
      let damage = { damaged_areas: [], damage_type: 'unknown', severity: 'unknown' };
      if (firstFrame?.frameBlob) {
        try {
          const b64 = await blobToBase64(firstFrame.frameBlob);
          damage = await analyzeDamage(b64);
        } catch (e) {
          console.warn('[ScanScene] analyzeDamage failed, proceeding with empty damage:', e.message);
        }
      }
      setDamageData(damage);
      let coverageResult = { coverage_decisions: [] };
      try {
        coverageResult = await checkCoverage(damage);
      } catch (e) {
        console.warn('[ScanScene] checkCoverage failed:', e.message);
      }
      setCoverageDecisions(coverageResult.coverage_decisions || []);
      const remaining = ANIM_MS - (Date.now() - startTime);
      if (remaining > 0) await sleep(remaining);
      clearInterval(animTimer); setProgress(100); setStage('coverage');
    } catch (err) {
      console.error('[ScanScene] immersive error:', err);
      clearInterval(animTimer);
      setScanError('Analysis failed. Check your connection and try again.');
      setStage('idle');
    }
  }

  const covMap = {};
  coverageDecisions.forEach(d => { covMap[d.area_name] = d.coverage_status; });

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'transparent' }}>

      {stage === 'generating' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020617', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#0d9488', marginBottom: 20, textTransform: 'uppercase', fontWeight: 600 }}>
            World Labs Marble
          </div>
          <div style={{ fontSize: 38, marginBottom: 18, color: '#0d9488' }}>{SPIN[spinIdx]}</div>
          <div style={{ fontSize: 21, fontWeight: 700, marginBottom: 26 }}>Generating 3D Reconstruction</div>
          <div style={{ width: 320, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#0d9488,#34d399)', transition: 'width 0.15s linear', borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{progress}%</div>
        </div>
      )}

      <ClaimHUD
        claimId={claim.claimId}
        adjuster={claim.adjuster}
        stage={stage === 'coverage' ? 'Coverage Active' : stage === 'generating' ? 'Processing' : 'Scanning'}
        progress={stage === 'scanning' ? progress : undefined}
      />
      {stage === 'idle' && immersiveActive && (
        <ImmersiveScan onCapture={handleImmersiveScan} onExit={() => setImmersiveActive(false)} />
      )}

      {stage === 'idle' && !immersiveActive && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          ...enableXRLayer({ zOffset: 0.5 }),
        }}>
          {xrSupported && !inWebSpatial && (
            <button className="spatial-btn" onClick={() => setImmersiveActive(true)} style={{
              padding: '14px 36px', background: '#0d9488', border: 'none',
              borderRadius: 40, color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>
              Enter Immersive Scan
            </button>
          )}
          {scanError && (
            <div style={{
              padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: 13, maxWidth: 360, textAlign: 'center',
            }}>
              {scanError}
            </div>
          )}
          <CameraCapture
            title="Scan Damage"
            subtitle={xrSupported ? 'Or capture a still photo instead.' : 'Capture the damaged vehicle.'}
            captureLabel="Capture Damage"
            busyLabel="Analyzing..."
            onCapture={handlePhotoScan}
          />
        </div>
      )}

      {stage === 'coverage' && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(2,6,23,0.6)', zIndex: 10,
        }}>
          <div style={{
            background: 'rgba(15,23,42,0.90)',
            borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)',
            padding: 28, width: 480, maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Coverage Analysis</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
              {coverageDecisions.length} area{coverageDecisions.length !== 1 ? 's' : ''} assessed
            </div>
            <div style={DIVIDER} />
            {coverageDecisions.map((d, i) => (
              <div key={i} style={{
                marginBottom: 10, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                borderLeft: `3px solid ${STATUS_COLORS[d.coverage_status] || '#94a3b8'}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'white', marginBottom: 2 }}>{d.area_name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{d.reason}</div>
              </div>
            ))}
            {coverageDecisions.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 12 }}>No coverage data available.</div>
            )}
            <div style={DIVIDER} />
            <button
              className="spatial-btn"
              onClick={() => onComplete(damageData, coverageDecisions, covMap, SPLAT_URL, voiceNotes)}
              style={{
                width: '100%', padding: '13px', background: '#0d9488', border: 'none',
                borderRadius: 12, color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Continue to Annotation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ScanScene ───────────────────────────────────────────────────────────

export default function ScanScene({ claim, onComplete }) {
  const [step, setStep] = useState('task');
  const [driver, setDriver] = useState({});

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SideNav />
      <div style={{ position: 'relative', zIndex: 10 }}>
        {step === 'task' && (
          <TaskCard onStart={() => setStep('uiq')} onDismiss={() => {}} />
        )}
        {step === 'uiq' && (
          <UIQTokenScreen onVerify={() => setStep('driver-choice')} />
        )}
        {step === 'driver-choice' && (
          <DriverDetailsChoice onManual={() => setStep('driver')} onScan={() => setStep('license')} />
        )}
        {step === 'license' && (
          <ScanLicenseScreen onCapture={() => setStep('driver')} onManual={() => setStep('driver')} />
        )}
        {step === 'driver' && (
          <DriverDetailsResult driver={driver} onCapturePhoto={() => setStep('photo')} onManual={() => setStep('driver')} />
        )}
        {step === 'photo' && (
          <CapturePhotoScreen onCapture={() => setStep('scan')} onBack={() => setStep('driver')} />
        )}
        {step === 'scan' && (
          <DamageScanScreen claim={claim} onComplete={onComplete} />
        )}
      </div>
    </div>
  );
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
