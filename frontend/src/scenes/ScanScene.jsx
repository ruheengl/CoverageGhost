import { useState, useRef, useEffect } from 'react';
import SideNav from '../components/SideNav';
import PolicyCitation from '../components/PolicyCitation';
import ClaimHUD from '../components/ClaimHUD';
import CameraCapture from '../components/CameraCapture';
import ImmersiveScan from '../components/ImmersiveScan';
import { enableXRLayer } from '../lib/enableXRLayer';
import { analyzeDamage, checkCoverage, imageToBase64, ocrDocument } from '../lib/api';

const isVisionPro = /visionOS/.test(navigator.userAgent);

const inWebSpatial = /WebSpatial\//.test(navigator.userAgent);
const SPLAT_URL = '/api/splat';
const ANIM_MS = 6000;
const SPIN = ['◐', '◓', '◑', '◒'];

const CARD = {
  background: 'rgba(93,93,93,0.80)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.14)',
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
        placeholder="UIQ - _ _ _ _ _ - _ _ _"
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 10,
          background: 'rgba(240,241,245,0.95)', fontSize: 14,
          color: '#1a1a2e', marginBottom: 20, fontFamily: 'monospace', boxSizing: 'border-box',
        }}
      />
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
        This helps the company to accurately identify and validate the specific approved policy details tied to this claim.
      </div>
      <button className="btn-primary spatial-btn" onClick={() => onVerify(token)} style={{ borderRadius: 12, width: '100%' }}>
        Verify Token
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Step 1 of 6</span>
      </div>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Step 1 of 6</span>
      </div>
    </div>
  );
}

function ScanLicenseScreen({ onCapture, onManual }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isVisionPro) return;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(() => {});
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  async function handleTrigger() {
    if (isVisionPro) { onCapture(null); return; }
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      stopStream();
      const data = await ocrDocument(b64, 'drivers_license');
      onCapture(data);
    } catch {
      stopStream();
      onCapture(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-up" style={CARD}>
      <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Scan Driver's License</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
        Point the camera at the license, then pull the trigger.
      </div>
      <div style={DIVIDER} />
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <button className="btn-primary spatial-btn" onClick={handleTrigger}
        style={{ borderRadius: 12, width: '100%', marginBottom: 10 }} disabled={busy}>
        {busy ? 'Reading…' : isVisionPro ? 'Continue' : 'Capture'}
      </button>
      <button className="spatial-btn" onClick={() => { stopStream(); onManual(); }} style={{
        marginTop: 10, width: '100%', padding: '11px',
        background: 'rgba(30,30,40,0.88)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12, color: 'rgba(255,255,255,0.55)', fontSize: 14, cursor: 'pointer',
      }}>
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
        <button className="btn-primary spatial-btn" onClick={onCapturePhoto} style={{ flex: 1 }}>Continue</button>
      </div>
    </div>
  );
}

function CapturePhotoScreen({ onCapture, onBack }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isVisionPro) return;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      })
      .catch(() => {});
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  function handleTrigger() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture();
  }

  return (
    <div className="fade-up" style={CARD}>
      <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Driver Photo</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
        Face the camera, then pull the trigger.
      </div>
      <div style={DIVIDER} />
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <button className="btn-primary spatial-btn" onClick={handleTrigger}
        style={{ borderRadius: 12, width: '100%', marginBottom: 10 }}>
        {isVisionPro ? 'Continue' : 'Capture'}
      </button>
      <button className="spatial-btn" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onBack(); }} style={{
        width: '100%', padding: '11px',
        background: 'rgba(30,30,40,0.88)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12, color: 'rgba(255,255,255,0.55)', fontSize: 14, cursor: 'pointer',
      }}>
        Enter Manually Instead
      </button>
    </div>
  );
}

function ScanVehicleRegScreen({ onCapture, onManual }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isVisionPro) return;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      })
      .catch(() => {});
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  function stopStream() { streamRef.current?.getTracks().forEach(t => t.stop()); }

  async function handleTrigger() {
    if (isVisionPro) { onCapture(null); return; }
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      stopStream();
      const data = await ocrDocument(b64, 'vehicle_registration');
      onCapture(data);
    } catch {
      stopStream();
      onCapture(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-up" style={CARD}>
      <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Scan Vehicle Registration</div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 16 }}>
        Point the camera at the registration card, then pull the trigger.
      </div>
      <div style={DIVIDER} />
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <button className="btn-primary spatial-btn" onClick={handleTrigger}
        style={{ borderRadius: 12, width: '100%', marginBottom: 10 }} disabled={busy}>
        {busy ? 'Reading…' : isVisionPro ? 'Continue' : 'Capture'}
      </button>
      <button className="spatial-btn" onClick={() => { stopStream(); onManual(); }} style={{
        width: '100%', padding: '11px',
        background: 'rgba(30,30,40,0.88)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12, color: 'rgba(255,255,255,0.55)', fontSize: 14, cursor: 'pointer',
      }}>
        Enter Manually Instead
      </button>
    </div>
  );
}

function RegistrationDetailsResult({ reg, onContinue }) {
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ color: 'white', fontSize: 19, fontWeight: 700 }}>Registration Details</div>
      </div>
      <div style={DIVIDER} />
      {[
        ['Name', reg.name || 'James Chen'],
        ['Age', reg.age || '37 Years'],
        ['Vehicle Identification Number (VIN)', reg.vin || '5NMS3CLBJNH033803'],
        ['License Plate Number', reg.plate || 'SEA MTR'],
        ['Vehicle Year, Make', reg.vehicle || '2021 Toyota Camry'],
        ['Registration Expiry Date', reg.expiry || 'Midnight Tue 11/30/2021'],
      ].map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 11, alignItems: 'flex-start' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, flexShrink: 0, maxWidth: '45%' }}>{label}</span>
          <span style={{ color: 'white', fontSize: 14, fontWeight: 500, textAlign: 'right', maxWidth: '52%' }}>{value}</span>
        </div>
      ))}
      <div style={DIVIDER} />
      <button className="btn-primary spatial-btn" onClick={onContinue} style={{ width: '100%', borderRadius: 12, padding: '13px' }}>
        Continue
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>Step 2 of 3</span>
      </div>
    </div>
  );
}

function VerifyPolicyDialog({ onDismiss, onVerify }) {
  return (
    <div className="fade-up" style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', zIndex: 50,
    }}>
      <div style={{
        ...CARD,
        maxWidth: 380,
        textAlign: 'center',
      }}>
        <div style={{ color: 'white', fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Verify Policy</div>
        <div style={{ color: 'rgba(255,255,255,0.50)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          Verify the captured information and check if coverage is active or not.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-secondary spatial-btn" onClick={onDismiss} style={{ flex: 1 }}>Dismiss</button>
          <button className="btn-primary spatial-btn" onClick={onVerify} style={{ flex: 1 }}>Verify</button>
        </div>
      </div>
    </div>
  );
}

function PolicyActiveScreen({ policyData, onProceed }) {
  const info = [
    ['Claimant', policyData.claimant || 'James Chen'],
    ['Policy #', policyData.policy_number || 'ALLST-2024-TX-00925'],
    ['Coverage', policyData.coverage || 'Comprehensive + collision'],
    ['Valid through', policyData.valid_through || 'Dec 31, 2026'],
    ['Open Claims', policyData.open_claims || 'None'],
  ];
  return (
    <div className="fade-up" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', flexShrink: 0 }} />
        <div style={{ color: 'white', fontSize: 19, fontWeight: 700 }}>Policy Active</div>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>
        Coverage is verified and eligible
      </div>
      <div style={DIVIDER} />
      {info.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{label}</span>
          <span style={{ color: 'white', fontSize: 14, fontWeight: 500, textAlign: 'right', maxWidth: '55%' }}>{value}</span>
        </div>
      ))}
      <div style={DIVIDER} />
      <button className="btn-primary spatial-btn" onClick={onProceed} style={{ width: '100%', borderRadius: 12, padding: '14px' }}>
        Proceed to Scan Vehicle
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
            background: 'rgba(93,93,93,0.80)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 20, border: '1px solid rgba(255,255,255,0.14)',
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
  const [reg, setReg] = useState({});
  const [policyData] = useState({
    claimant: claim?.adjuster || 'James Chen',
    policy_number: 'ALLST-2024-TX-00925',
    coverage: 'Comprehensive + collision',
    valid_through: 'Dec 31, 2026',
    open_claims: 'None',
  });

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
          <ScanLicenseScreen
            onCapture={(data) => { if (data) setDriver(data); setStep('driver'); }}
            onManual={() => setStep('driver')}
          />
        )}
        {step === 'driver' && (
          <DriverDetailsResult driver={driver} onCapturePhoto={() => setStep('photo')} onManual={() => setStep('driver')} />
        )}
        {step === 'photo' && (
          <CapturePhotoScreen onCapture={() => setStep('vehicle-reg')} onBack={() => setStep('driver')} />
        )}
        {step === 'vehicle-reg' && (
          <ScanVehicleRegScreen onCapture={(data) => { if (data) setReg(data); setStep('reg-details'); }} onManual={() => setStep('reg-details')} />
        )}
        {step === 'reg-details' && (
          <RegistrationDetailsResult reg={reg} onContinue={() => setStep('verify-claim')} />
        )}
        {step === 'verify-claim' && (
          <VerifyPolicyDialog onDismiss={() => setStep('vehicle-reg')} onVerify={() => setStep('policy-active')} />
        )}
        {step === 'policy-active' && (
          <PolicyActiveScreen policyData={policyData} onProceed={() => setStep('scan')} />
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
