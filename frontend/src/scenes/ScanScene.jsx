import { useState, useRef } from 'react';
import CoverageOverlay from '../components/CoverageOverlay';
import PolicyCitation from '../components/PolicyCitation';
import ClaimHUD from '../components/ClaimHUD';
import { enableXRLayer } from '../lib/enableXRLayer';
import { analyzeDamage, checkCoverage, imageToBase64 } from '../lib/api';

// Hardcoded positions for policy citation cards — adjust after testing in Vision Pro
const CITATION_POSITIONS = [
  { x: '65%', y: '30%', z: 0.4 },
  { x: '20%', y: '55%', z: 0.35 },
  { x: '70%', y: '65%', z: 0.3 },
];

export default function ScanScene({ claim, onComplete }) {
  const [stage, setStage] = useState('idle'); // idle | scanning | coverage | done
  const [coverageMap, setCoverageMap] = useState({});
  const [coverageDecisions, setCoverageDecisions] = useState([]);
  const [damageData, setDamageData] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef(null);

  const GLB_URL = '/assets/teex-car.glb'; // Put your Teex GLB in frontend/public/assets/

  async function handleScan(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStage('scanning');

    // Fake scan progress animation (45 seconds feels too long for demo — use 8s)
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
      coverageResult.coverage_decisions.forEach(d => {
        map[d.area_name] = d.coverage_status;
      });
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
    <div style={{ minHeight: '100vh', position: 'relative',
      background: 'transparent', fontFamily: 'Arial' }}>

      <ClaimHUD claimId={claim.claimId} adjuster={claim.adjuster}
        stage={stage === 'coverage' ? 'Coverage Active' : 'Scanning'}
        progress={stage === 'scanning' ? progress : undefined} />

      {/* GLB + Coverage Overlay — always visible once GLB loads */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <CoverageOverlay glbUrl={GLB_URL} coverageMap={coverageMap} />
      </div>

      {/* Policy citation cards — appear after coverage loads */}
      {stage === 'coverage' && coverageDecisions.slice(0, 3).map((d, i) => (
        <PolicyCitation key={i} decision={d} position={CITATION_POSITIONS[i]} />
      ))}

      {/* Scan trigger */}
      {stage === 'idle' && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%',
          transform: 'translateX(-50%)',
          ...enableXRLayer({ zOffset: 0.5 })
        }}>
          <button onClick={() => fileRef.current?.click()}
            style={{ padding: '14px 32px', background: '#0d9488',
              border: 'none', borderRadius: 40, color: 'white',
              fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Scan Damage
          </button>
          <input ref={fileRef} type='file' accept='image/*'
            style={{ display: 'none' }} onChange={handleScan} />
        </div>
      )}

      {/* Continue button after coverage loads */}
      {stage === 'coverage' && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%',
          transform: 'translateX(-50%)',
          ...enableXRLayer({ zOffset: 0.5 })
        }}>
          <button onClick={() => onComplete(damageData, coverageDecisions)}
            style={{ padding: '14px 32px', background: '#0d9488',
              border: 'none', borderRadius: 40, color: 'white',
              fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Continue to Annotation
          </button>
        </div>
      )}
    </div>
  );
}
