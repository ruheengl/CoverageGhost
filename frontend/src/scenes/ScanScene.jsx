import { useState, useRef, useEffect } from 'react';
import AppBackground from '../components/AppBackground';
import SideNav from '../components/SideNav';
import CoverageOverlay from '../components/CoverageOverlay';
import PolicyCitation from '../components/PolicyCitation';
import ClaimHUD from '../components/ClaimHUD';
import CameraCapture from '../components/CameraCapture';
import ImmersiveScan from '../components/ImmersiveScan';
import { enableXRLayer } from '../lib/enableXRLayer';
import { analyzeDamage, checkCoverage, imageToBase64 } from '../lib/api';

const inWebSpatial = /WebSpatial\//.test(navigator.userAgent);
const CITATION_POSITIONS = [
  { x: '65%', y: '30%', z: 0.4 },
  { x: '20%', y: '55%', z: 0.35 },
  { x: '70%', y: '65%', z: 0.3 },
];
const SPLAT_URL = '/assets/teex-car.spz';
const GLB_URL = '/assets/teex-car.glb';
const ANIM_MS = 6000;
const SPIN = ['◐', '◓', '◑', '◒'];

// ─── UI Sub-screens ───────────────────────────────────────────────────────────

function TaskCard({ onStart, onDismiss }) {
  return (
    <div className="fade-up" style={{
      background: 'rgba(58,58,58,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)', padding: 28, width: 480,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
        <div>
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>New Task Assigned</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>20 mins ago | From HQ</div>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 20 }} />
      {[
        ['Case ID', 'CLM-2024-8821'],
        ['Vehicle', '2021 Toyota Camry'],
        ['Claimant', 'James Chen'],
        ['Location', 'I-95 N, Houston TX'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>{value}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '20px 0' }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary" onClick={onDismiss} style={{ flex: 1, color: '#1a3ecf', fontWeight: 600 }}>Dismiss Case</button>
        <button className="btn-primary" onClick={onStart} style={{ flex: 1 }}>Start Inspection</button>
      </div>
    </div>
  );
}

function UIQTokenScreen({ onVerify }) {
  const [token, setToken] = useState('');
  return (
    <div className="fade-up" style={{
      background: 'rgba(58,58,58,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)', padding: 28, width: 480,
    }}>
      <div style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>UIQ Token</div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 16 }}>Enter the unique inspection token provided by HQ for this claim.</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 20 }} />
      <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 8, display: 'block' }}>UIQ Token number</label>
      <input
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="UIQ - _ _ _ _ _ - _ _ _"
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          background: 'rgba(240,241,245,0.95)', fontSize: 14,
          color: '#1a1a2e', marginBottom: 14, fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
        }}
      />
      <div style={{ color: 'rgba(255,255,255,0.50)', fontSize: 13, marginBottom: 20 }}>
        This helps the company to accurately identify and validate the specific approved policy details tied to this claim.
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 20 }} />
      <button className="btn-primary" onClick={() => onVerify(token)} style={{ borderRadius: 12 }}>Verify UIQ Token</button>
    </div>
  );
}

function DriverDetailsChoice({ onManual, onScan }) {
  return (
    <div className="fade-up" style={{
      background: 'rgba(58,58,58,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)', padding: 28, width: 480,
    }}>
      <div style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Input Driver&apos;s Details</div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 16 }}>Enter the unique inspection token provided by HQ for this claim.</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 24 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary" onClick={onManual} style={{ flex: 1 }}>Enter Manually</button>
        <button className="btn-primary" onClick={onScan} style={{ flex: 1 }}>Scan Document</button>
      </div>
    </div>
  );
}

function ScanLicenseScreen({ onCapture, onManual }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="fade-up" style={{
      background: 'rgba(58,58,58,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)', padding: 28, width: 480,
    }}>
      <div style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Scan Driver&apos;s License</div>
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: '2px solid #1a3ecf', borderRadius: 14, height: 200, overflow: 'hidden',
          cursor: 'pointer', background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}
      >
        {preview
          ? <img src={preview} alt="License preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Tap to open camera</span>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary" onClick={onManual} style={{ flex: 1 }}>Enter Manually</button>
        <button className="btn-primary" onClick={() => onCapture(preview)} style={{ flex: 1 }}>Capture</button>
      </div>
    </div>
  );
}

function DriverDetailsResult({ driver, onCapturePhoto }) {
  return (
    <div className="fade-up" style={{
      background: 'rgba(58,58,58,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)', padding: 28, width: 480,
    }}>
      <div style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Driver&apos;s Details</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', marginBottom: 16 }} />
      {[
        ['Name', driver.name || 'James Chen'],
        ['Age', driver.age || '37 Years'],
        ['Driving License No.', driver.license || '5463-78-7214'],
        ['Address', driver.address || '1424, S Jentilly Ln, Tempe, AZ'],
        ['Validity', driver.validity || 'June 28th, 2030'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 13 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 15, fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.12)', margin: '16px 0' }} />
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Driver&apos;s Photo</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-secondary" style={{ flex: 1, color: '#1a3ecf', fontWeight: 600 }}>Enter Manually</button>
        <button className="btn-primary" onClick={onCapturePhoto} style={{ flex: 1 }}>Capture Photo</button>
      </div>
    </div>
  );
}

function CapturePhotoScreen({ onCapture }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="fade-up" style={{
      background: 'rgba(58,58,58,0.87)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.4)', padding: 28, width: 480,
    }}>
      <div style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Capture Driver&apos;s Photo</div>
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: '2px solid #1a3ecf', borderRadius: 14, height: 200, overflow: 'hidden',
          cursor: 'pointer', background: 'rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}
      >
        {preview
          ? <img src={preview} alt="Driver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Tap to open camera</span>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleFile} />
      <button className="btn-primary" onClick={() => onCapture(preview)} style={{ borderRadius: 12 }}>Capture</button>
    </div>
  );
}

// ─── Damage Scan (uses teammate's backend logic) ──────────────────────────────

function DamageScanScreen({ claim, onComplete }) {
  const [stage, setStage] = useState('idle');
  const [coverageMap, setCoverageMap] = useState({});
  const [coverageDecisions, setCoverageDecisions] = useState([]);
  const [damageData, setDamageData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [xrSupported, setXrSupported] = useState(false);
  const [immersiveActive, setImmersiveActive] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [spinIdx, setSpinIdx] = useState(0);

  const GLB_URL = '/assets/teex-car.glb';

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

  // Desktop / PICO photo path
  async function handlePhotoScan(file) {
    if (!file) return;
    setStage('scanning');
    let p = 0;
    const timer = setInterval(() => {
      p += 2; setProgress(Math.min(p, 95));
      if (p >= 95) clearInterval(timer);
    }, 160);
    try {
      const b64 = await imageToBase64(file);
      const damage = await analyzeDamage(b64);
      setDamageData(damage);
      const coverageResult = await checkCoverage(damage);
      const map = {};
      coverageResult.coverage_decisions.forEach(d => { map[d.area_name] = d.coverage_status; });
      setCoverageMap(map);
      setCoverageDecisions(coverageResult.coverage_decisions);
      clearInterval(timer);
      setProgress(100);
      setStage('coverage');
    } catch (err) {
      console.error(err);
      clearInterval(timer);
      setStage('idle');
    }
  }

  // ImmersiveScan completion — frames from angle-bucket capture + voice notes
  async function handleImmersiveScan(frames, notes) {
    setVoiceNotes(notes);
    setImmersiveActive(false);
    setStage('generating');
    setProgress(0);

    const startTime = Date.now();
    const animTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min(Math.round((elapsed / ANIM_MS) * 100), 99));
    }, 150);

    try {
      const firstFrame = frames[0];
      let damage = { damaged_areas: [] };
      if (firstFrame?.frameBlob) {
        const b64 = await blobToBase64(firstFrame.frameBlob);
        damage = await analyzeDamage(b64);
      }
      setDamageData(damage);

      const coverageResult = await checkCoverage(damage);
      const map = {};
      coverageResult.coverage_decisions.forEach(d => { map[d.area_name] = d.coverage_status; });
      setCoverageMap(map);
      setCoverageDecisions(coverageResult.coverage_decisions);

      const remaining = ANIM_MS - (Date.now() - startTime);
      if (remaining > 0) await sleep(remaining);

      clearInterval(animTimer);
      setProgress(100);
      setStage('coverage');
    } catch (err) {
      console.error('[ScanScene] immersive scan error:', err);
      clearInterval(animTimer);
      setStage('idle');
    }
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: 'transparent', fontFamily: 'Arial' }}>

      {stage === 'generating' && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020617', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'white',
        }}>
          <div style={{ fontSize: 12, letterSpacing: 4, color: '#0d9488', marginBottom: 24, textTransform: 'uppercase', fontWeight: 600 }}>
            World Labs Marble
          </div>
          <div style={{ fontSize: 40, marginBottom: 20, color: '#0d9488' }}>{SPIN[spinIdx]}</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>Generating 3D Reconstruction</div>
          <div style={{ width: 340, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: 'linear-gradient(90deg, #0d9488, #34d399)',
              transition: 'width 0.15s linear', borderRadius: 6,
            }} />
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>{progress}% complete</div>
        </div>
      )}

      <ClaimHUD
        claimId={claim.claimId}
        adjuster={claim.adjuster}
        stage={stage === 'coverage' ? 'Coverage Active' : stage === 'generating' ? 'Processing' : 'Scanning'}
        progress={stage === 'scanning' ? progress : undefined}
      />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <CoverageOverlay glbUrl={GLB_URL} coverageMap={coverageMap} />
      </div>
      {stage === 'coverage' && coverageDecisions.slice(0, 3).map((d, i) => (
        <PolicyCitation key={i} decision={d} position={CITATION_POSITIONS[i]} />
      ))}
      {stage === 'idle' && immersiveActive && (
        <ImmersiveScan
          onCapture={handleImmersiveScan}
          onExit={() => setImmersiveActive(false)}
        />
      )}
      {stage === 'idle' && !immersiveActive && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          ...enableXRLayer({ zOffset: 0.5 }),
        }}>
          {xrSupported && !inWebSpatial && (
            <button
              onClick={() => setImmersiveActive(true)}
              style={{
                padding: '14px 32px', background: '#0d9488', border: 'none',
                borderRadius: 40, color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Enter Immersive Scan
            </button>
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
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          ...enableXRLayer({ zOffset: 0.5 }),
        }}>
          <button
            onClick={() => onComplete(damageData, coverageDecisions, coverageMap, SPLAT_URL, voiceNotes)}
            style={{
              padding: '14px 32px', background: '#0d9488', border: 'none',
              borderRadius: 40, color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Continue to Annotation
          </button>
        </div>
      )}
    </div>
  );
}

export default function ScanScene({ claim, onComplete }) {
  const [step, setStep] = useState('task');
  const [driver, setDriver] = useState({});

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AppBackground />
      <SideNav />
      <div style={{ position: 'relative', zIndex: 10 }}>
        {step === 'task' && (
          <TaskCard
            onStart={() => setStep('uiq')}
            onDismiss={() => setStep('task')}
          />
        )}
        {step === 'uiq' && (
          <UIQTokenScreen onVerify={() => setStep('driver-choice')} />
        )}
        {step === 'driver-choice' && (
          <DriverDetailsChoice
            onManual={() => setStep('driver')}
            onScan={() => setStep('license')}
          />
        )}
        {step === 'license' && (
          <ScanLicenseScreen
            onCapture={() => setStep('driver')}
            onManual={() => setStep('driver')}
          />
        )}
        {step === 'driver' && (
          <DriverDetailsResult
            driver={driver}
            onCapturePhoto={() => setStep('photo')}
          />
        )}
        {step === 'photo' && (
          <CapturePhotoScreen onCapture={() => setStep('scan')} />
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
