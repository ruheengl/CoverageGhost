import { useState, useEffect } from 'react';
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

export default function ScanScene({ claim, onComplete }) {
  const [stage, setStage] = useState('idle');
  const [coverageMap, setCoverageMap] = useState({});
  const [coverageDecisions, setCoverageDecisions] = useState([]);
  const [damageData, setDamageData] = useState(null);
  const [progress, setProgress] = useState(0);
  const [xrSupported, setXrSupported] = useState(false);
  const [immersiveActive, setImmersiveActive] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [spinIdx, setSpinIdx] = useState(0);

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

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
