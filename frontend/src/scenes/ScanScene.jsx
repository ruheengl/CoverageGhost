import { useState, useRef } from 'react';
import AppBackground from '../components/AppBackground';
import SideNav from '../components/SideNav';
import CameraCapture from '../components/CameraCapture';
import ImmersiveScan from '../components/ImmersiveScan';
import { enableXRLayer } from '../lib/enableXRLayer';
import { analyzeDamage, checkCoverage, imageToBase64 } from '../lib/api';

const inWebSpatial = /WebSpatial\//.test(navigator.userAgent);
const SPLAT_URL = '/api/splat';
const ANIM_MS = 6000;
const SPIN = ['◐', '◓', '◑', '◒'];

// ── Design tokens ─────────────────────────────────────────────────────────────
const CARD = {
  background: 'rgba(22,24,30,0.92)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: '0 12px 48px rgba(0,0,0,0.55)',
  padding: 28,
  width: 440,
};

const DIVIDER = { height: 1, background: 'rgba(255,255,255,0.09)', margin: '16px 0' };

const STATUS_DOT = { green: '#30d158', red: '#ff453a', amber: '#ffd60a', gray: '#636366' };

// ── Step progress indicator ───────────────────────────────────────────────────

function StepNav({ current, total, onBack, onNext }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
      <button
        onClick={onBack}
        disabled={!onBack}
        style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'white', fontSize: 15, cursor: onBack ? 'pointer' : 'default',
          opacity: onBack ? 1 : 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >‹</button>
      <div style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            width: i === current ? 18 : 6, height: 6, borderRadius: 3,
            background: i === current ? 'rgba(255,255,255,0.9)' : i < current ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)',
            transition: 'all 0.2s ease',
          }} />
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!onNext}
        style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'white', fontSize: 15, cursor: onNext ? 'pointer' : 'default',
          opacity: onNext ? 1 : 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >›</button>
    </div>
  );
}

// ── 6.6-style minimal capture card ───────────────────────────────────────────

function SimpleCaptureCard({ title, subtitle, step, total, onCapture, onBack, onNext }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    await onCapture(file).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: 360,
        padding: '32px 28px 28px',
        background: 'rgba(22,24,30,0.90)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.55)',
        textAlign: 'center',
      }}>
        <div style={{ color: 'white', fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 26, lineHeight: 1.55 }}>
          {subtitle}
        </div>
        <input
          ref={inputRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-primary"
          style={{ opacity: busy ? 0.6 : 1, marginBottom: 0 }}
        >
          {busy ? 'Processing...' : 'Capture'}
        </button>
      </div>
      <StepNav current={step} total={total} onBack={onBack || undefined} onNext={onNext || undefined} />
    </div>
  );
}

// ── Sub-screens ────────────────────────────────────────────────────────────────

function TaskCard({ onStart, onDismiss }) {
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT.green, flexShrink: 0 }} />
        <div>
          <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>New Task Assigned</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>20 mins ago · From HQ</div>
        </div>
      </div>
      <div style={DIVIDER} />
      {[
        ['Case ID', 'CLM-2024-8821'],
        ['Vehicle', '2021 Toyota Camry'],
        ['Claimant', 'James Chen'],
        ['Location', 'I-95 N, Houston TX'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 11 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{value}</span>
        </div>
      ))}
      <div style={DIVIDER} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" onClick={onDismiss} style={{ flex: 1 }}>Dismiss</button>
        <button className="btn-primary" onClick={onStart} style={{ flex: 1 }}>Start Inspection</button>
      </div>
    </div>
  );
}

function UIQTokenScreen({ onVerify, onBack }) {
  const [token, setToken] = useState('');
  return (
    <div className="fade-up" style={{ ...CARD, width: 400 }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>UIQ Token</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>
        Enter the unique inspection token provided by HQ for this claim.
      </div>
      <div style={DIVIDER} />
      <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 5, display: 'block' }}>
        UIQ Token number
      </label>
      <input
        value={token}
        onChange={e => setToken(e.target.value)}
        placeholder="UIQ-_____-___"
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 10,
          background: 'rgba(240,241,245,0.95)', fontSize: 14,
          color: '#1a1a2e', marginBottom: 18, fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
        }}
      />
      <button className="btn-primary" onClick={() => onVerify(token)} style={{ marginBottom: 0 }}>
        Verify UIQ Token
      </button>
      <StepNav current={0} total={5} onBack={onBack} onNext={null} />
    </div>
  );
}

function DriverDetailsChoice({ onManual, onScan, onBack }) {
  return (
    <div className="fade-up" style={{ ...CARD, width: 380 }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Driver Details</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>
        How would you like to input the driver&apos;s details?
      </div>
      <div style={DIVIDER} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" onClick={onManual} style={{ flex: 1 }}>Enter Manually</button>
        <button className="btn-primary" onClick={onScan} style={{ flex: 1 }}>Scan Document</button>
      </div>
      <StepNav current={0} total={5} onBack={onBack} onNext={null} />
    </div>
  );
}

function DriverDetailsResult({ driver, onCapturePhoto, onManual, onBack }) {
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Driver Details</div>
      <div style={DIVIDER} />
      {[
        ['Name', driver.name || 'James Chen'],
        ['Age', driver.age || '37 Years'],
        ['License No.', driver.license || '5463-78-7214'],
        ['Address', driver.address || '1424 S Jentilly Ln, Tempe AZ'],
        ['Valid Until', driver.validity || 'June 28, 2030'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
        </div>
      ))}
      <div style={DIVIDER} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" onClick={onManual} style={{ flex: 1 }}>Edit</button>
        <button className="btn-primary" onClick={onCapturePhoto} style={{ flex: 1 }}>Capture Photo</button>
      </div>
    </div>
  );
}

function VehicleDetailsScreen({ onBegin, onBack }) {
  const [engineNum, setEngineNum] = useState('');
  const [chassisNum, setChassisNum] = useState('');
  const INPUT_S = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    background: 'rgba(240,241,245,0.95)', fontSize: 14,
    color: '#1a1a2e', marginBottom: 14, fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
  };
  return (
    <div className="fade-up" style={{ ...CARD, width: 400 }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Input Vehicle Details</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>
        Enter vehicle identification numbers or scan in the next steps.
      </div>
      <div style={DIVIDER} />
      <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 5, display: 'block' }}>Engine Number</label>
      <input value={engineNum} onChange={e => setEngineNum(e.target.value)} placeholder="e.g. 2AR-FE-1234567" style={INPUT_S} />
      <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 5, display: 'block' }}>Chassis Number (VIN)</label>
      <input value={chassisNum} onChange={e => setChassisNum(e.target.value)} placeholder="e.g. JTMBE33V985086001" style={INPUT_S} />
      <div style={DIVIDER} />
      <button className="btn-primary" onClick={() => onBegin({ engineNum, chassisNum })}>Begin</button>
      <StepNav current={2} total={5} onBack={onBack} onNext={null} />
    </div>
  );
}

function VerifyClaimScreen({ onVerify, onDismiss, onBack }) {
  return (
    <div className="fade-up" style={{ ...CARD, width: 380 }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Verify Policy</div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 }}>
        Verify the captured information and check if coverage is active.
      </div>
      <div style={DIVIDER} />
      {[
        ['Policy Status', 'Active'],
        ['Coverage Type', 'Comprehensive'],
        ['Deductible', '$500'],
        ['Valid Until', 'Dec 31, 2026'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{value}</span>
        </div>
      ))}
      <div style={DIVIDER} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn-secondary" onClick={onDismiss} style={{ flex: 1 }}>Dismiss</button>
        <button className="btn-primary" onClick={onVerify} style={{ flex: 1 }}>Verify</button>
      </div>
      <StepNav current={4} total={5} onBack={onBack} onNext={null} />
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

  require('react').useEffect(() => {
    if (!inWebSpatial) {
      navigator.xr?.isSessionSupported('immersive-ar').then(setXrSupported).catch(() => {});
    }
  }, []);

  require('react').useEffect(() => {
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
        } catch (e) { console.warn('[ScanScene] analyzeDamage failed:', e.message); }
      }
      setDamageData(damage);
      let coverageResult = { coverage_decisions: [] };
      try { coverageResult = await checkCoverage(damage); }
      catch (e) { console.warn('[ScanScene] checkCoverage failed:', e.message); }
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
          position: 'fixed', inset: 0, background: 'rgba(10,10,14,0.95)', zIndex: 100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white',
        }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: 'rgba(255,255,255,0.4)', marginBottom: 20, textTransform: 'uppercase', fontWeight: 600 }}>
            World Labs Marble
          </div>
          <div style={{ fontSize: 36, marginBottom: 16, color: 'rgba(255,255,255,0.7)' }}>{SPIN[spinIdx]}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Generating 3D Reconstruction</div>
          <div style={{ width: 280, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'rgba(255,255,255,0.6)', transition: 'width 0.15s linear', borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{progress}%</div>
        </div>
      )}

      {stage === 'idle' && immersiveActive && (
        <ImmersiveScan onCapture={handleImmersiveScan} onExit={() => setImmersiveActive(false)} />
      )}

      {stage === 'idle' && !immersiveActive && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          ...enableXRLayer({ zOffset: 0.5 }),
        }}>
          {xrSupported && !inWebSpatial && (
            <button onClick={() => setImmersiveActive(true)} className="btn-primary" style={{ width: 280 }}>
              Enter Immersive Scan
            </button>
          )}
          {scanError && (
            <div style={{
              padding: '10px 16px', borderRadius: 10,
              background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)',
              color: '#ff6b6b', fontSize: 13, maxWidth: 340, textAlign: 'center',
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
          background: 'rgba(0,0,0,0.55)', zIndex: 10,
        }}>
          <div style={{
            ...CARD, maxHeight: '80vh', overflowY: 'auto', width: 440,
          }}>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 3 }}>Coverage Analysis</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 14 }}>
              {coverageDecisions.length} area{coverageDecisions.length !== 1 ? 's' : ''} assessed
            </div>
            <div style={DIVIDER} />
            {coverageDecisions.map((d, i) => (
              <div key={i} style={{
                marginBottom: 8, padding: '9px 11px', borderRadius: 9,
                background: 'rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${STATUS_DOT[d.coverage_status] || STATUS_DOT.gray}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'white', marginBottom: 2 }}>{d.area_name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{d.reason}</div>
              </div>
            ))}
            {coverageDecisions.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginBottom: 10 }}>No coverage data available.</div>
            )}
            <div style={DIVIDER} />
            <button
              onClick={() => onComplete(damageData, coverageDecisions, covMap, SPLAT_URL, voiceNotes)}
              className="btn-primary"
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
    <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AppBackground />
      <SideNav />
      <div style={{ position: 'relative', zIndex: 10 }}>

        {step === 'task' && (
          <TaskCard onStart={() => setStep('uiq')} onDismiss={() => {}} />
        )}
        {step === 'uiq' && (
          <UIQTokenScreen onVerify={() => setStep('driver-choice')} onBack={() => setStep('task')} />
        )}
        {step === 'driver-choice' && (
          <DriverDetailsChoice
            onManual={() => setStep('driver')}
            onScan={() => setStep('license')}
            onBack={() => setStep('uiq')}
          />
        )}
        {step === 'license' && (
          <SimpleCaptureCard
            title="Scan Driver's License"
            subtitle="Point the camera at the license to extract details automatically."
            step={0}
            total={5}
            onCapture={async () => setStep('driver')}
            onBack={() => setStep('driver-choice')}
            onNext={() => setStep('driver')}
          />
        )}
        {step === 'driver' && (
          <DriverDetailsResult
            driver={driver}
            onCapturePhoto={() => setStep('photo')}
            onManual={() => setStep('driver')}
            onBack={() => setStep('driver-choice')}
          />
        )}
        {step === 'photo' && (
          <SimpleCaptureCard
            title="Capture Driver's Photo"
            subtitle="Press the trigger button to capture."
            step={1}
            total={5}
            onCapture={async () => setStep('vehicle-details')}
            onBack={() => setStep('driver')}
          />
        )}
        {step === 'vehicle-details' && (
          <VehicleDetailsScreen
            onBegin={() => setStep('scan-engine')}
            onBack={() => setStep('photo')}
          />
        )}
        {step === 'scan-engine' && (
          <SimpleCaptureCard
            title="Scan Engine Number"
            subtitle="Point the camera at the engine number plate and capture."
            step={2}
            total={5}
            onCapture={async () => setStep('scan-chassis')}
            onBack={() => setStep('vehicle-details')}
            onNext={() => setStep('scan-chassis')}
          />
        )}
        {step === 'scan-chassis' && (
          <SimpleCaptureCard
            title="Scan Chassis Number"
            subtitle="Point the camera at the chassis VIN plate and capture."
            step={3}
            total={5}
            onCapture={async () => setStep('verify-claim')}
            onBack={() => setStep('scan-engine')}
            onNext={() => setStep('verify-claim')}
          />
        )}
        {step === 'verify-claim' && (
          <VerifyClaimScreen
            onVerify={() => setStep('scan')}
            onDismiss={() => setStep('vehicle-details')}
            onBack={() => setStep('scan-chassis')}
          />
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
