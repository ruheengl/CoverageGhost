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

  const GLB_URL = '/assets/teex-car.glb';

  useEffect(() => {
    if (!inWebSpatial) {
      navigator.xr?.isSessionSupported('immersive-ar').then(setXrSupported).catch(() => {});
    }
  }, []);

  // Accepts a File object (from CameraCapture) or falls back gracefully
  async function handleScan(file) {
    if (!file) return;
    setStage('scanning');
    let p = 0;
    const timer = setInterval(() => {
      p += 2;
      setProgress(Math.min(p, 95));
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

  return (
    <div style={{ minHeight: '100vh', position: 'relative', fontFamily: 'var(--font)' }}>
      <ClaimHUD
        claimId={claim.claimId}
        adjuster={claim.adjuster}
        stage={stage === 'coverage' ? 'Coverage Active' : 'Scanning'}
        progress={stage === 'scanning' ? progress : undefined}
      />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <CoverageOverlay glbUrl={GLB_URL} coverageMap={coverageMap} />
      </div>
      {stage === 'coverage' && coverageDecisions.slice(0, 3).map((d, i) => (
        <PolicyCitation key={i} decision={d} position={CITATION_POSITIONS[i]} />
      ))}
      {stage === 'idle' && immersiveActive && (
        <ImmersiveScan onCapture={handleScan} onExit={() => setImmersiveActive(false)} />
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
              style={{ padding: '14px 32px', background: '#0d9488', border: 'none', borderRadius: 40, color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
            >
              Enter Immersive Scan
            </button>
          )}
          <CameraCapture
            title="Scan Damage"
            subtitle={xrSupported ? 'Or capture a still photo instead.' : 'Capture the damaged vehicle.'}
            captureLabel="Capture Damage"
            busyLabel="Analyzing..."
            onCapture={handleScan}
          />
        </div>
      )}
      {stage === 'coverage' && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', ...enableXRLayer({ zOffset: 0.5 }) }}>
          <button
            onClick={() => onComplete(damageData, coverageDecisions)}
            style={{ padding: '14px 32px', background: '#0d9488', border: 'none', borderRadius: 40, color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
          >
            Continue to Annotation
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step Navigator ───────────────────────────────────────────────────────────

function StepNav({ current, total, onBack, onNext }) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 16,
      background: 'rgba(52,52,52,0.88)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)', borderRadius: 50,
      border: '1px solid rgba(255,255,255,0.10)',
      padding: '10px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.35)', zIndex: 200,
    }}>
      <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
      <span style={{ color: 'white', fontSize: 15, fontWeight: 500 }}>Step {current} of {total}</span>
      <button onClick={onNext} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
    </div>
  );
}

// ─── Main ScanScene ───────────────────────────────────────────────────────────

const STEPS = ['tasks', 'uiq', 'driver-choice', 'scan-license', 'driver-result', 'capture-photo', 'damage-scan'];

export default function ScanScene({ claim, onComplete }) {
  const [navActive, setNavActive] = useState('tasks');
  const [step, setStep] = useState(0);
  const [driverData] = useState({});
  const [navExpanded, setNavExpanded] = useState(true);

  const currentStep = STEPS[step];
  const showStepNav = step >= 1 && step <= 5;
  const stepNavCurrent = step <= 2 ? 1 : 2;

  function next() { setStep(s => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setStep(s => Math.max(s - 1, 0)); }

  if (currentStep === 'damage-scan') {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
        <AppBackground />
        <SideNav active="tasks" onNavigate={setNavActive} expanded={false} />
        <DamageScanScreen claim={claim} onComplete={onComplete} />
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AppBackground />
      <SideNav
        active={navActive}
        onNavigate={id => { setNavActive(id); if (id === 'new') setStep(0); }}
        expanded={navExpanded}
      />

      <div style={{ position: 'relative', zIndex: 10, marginLeft: navExpanded ? 240 : 82, transition: 'margin-left 0.2s' }}>
        {currentStep === 'tasks' && (
          <TaskCard
            onStart={() => { setNavActive('tasks'); setStep(1); setNavExpanded(false); }}
            onDismiss={() => {}}
          />
        )}
        {currentStep === 'uiq' && <UIQTokenScreen onVerify={() => next()} />}
        {currentStep === 'driver-choice' && <DriverDetailsChoice onManual={() => next()} onScan={() => next()} />}
        {currentStep === 'scan-license' && <ScanLicenseScreen onCapture={() => next()} onManual={() => next()} />}
        {currentStep === 'driver-result' && <DriverDetailsResult driver={driverData} onCapturePhoto={() => next()} />}
        {currentStep === 'capture-photo' && <CapturePhotoScreen onCapture={() => next()} />}
      </div>

      {currentStep === 'tasks' && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 4, background: 'rgba(52,52,52,0.88)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 50, border: '1px solid rgba(255,255,255,0.10)',
          padding: 6, zIndex: 200,
        }}>
          {['New', 'In Progress', 'Completed'].map((tab, i) => (
            <button key={tab} style={{
              padding: '8px 22px', borderRadius: 40, fontSize: 14, fontWeight: i === 0 ? 600 : 400,
              background: i === 0 ? 'rgba(80,80,80,0.9)' : 'transparent',
              color: 'white', fontFamily: 'var(--font)',
            }}>{tab}</button>
          ))}
        </div>
      )}

      {showStepNav && <StepNav current={stepNavCurrent} total={3} onBack={back} onNext={next} />}
    </div>
  );
}
