import { useState, useEffect } from 'react';
import AppBackground from '../components/AppBackground';
import SideNav from '../components/SideNav';
import GaussianViewer from '../components/GaussianViewer';

const CARD = {
  background: 'rgba(30,30,40,0.70)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
};

const DIVIDER = { height: 1, background: 'rgba(255,255,255,0.10)', margin: '14px 0' };

export default function ReviewScene({ claim, damageData, coverageDecisions = [], splatUrl, onView3D }) {
  const [submitted, setSubmitted] = useState(false);
  const [show3D, setShow3D] = useState(true);
  const [frames, setFrames] = useState([]);
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    fetch('/api/scan-frames/latest')
      .then(r => r.json())
      .then(data => setFrames(data.frames || []))
      .catch(() => {});
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AppBackground />
      <SideNav active="report" />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Report card ── */}
        <div style={{ ...CARD, padding: 20, width: 300 }}>
          {/* Header */}
          <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Report Generation</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 }}>
            AI generated claim report of the incident you just recorded.
          </div>
          <div style={DIVIDER} />

          {/* Claim report image */}
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <img
              src="/assets/claim-report.png"
              alt="Claim Report"
              style={{ width: '100%', display: 'block' }}
            />
          </div>

          <div style={DIVIDER} />

          {/* Submit */}
          {submitted ? (
            <div style={{
              padding: '12px', borderRadius: 12, textAlign: 'center',
              background: 'rgba(26,60,239,0.18)', border: '1px solid rgba(26,60,239,0.30)',
            }}>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 13 }}>✓ Report Submitted</div>
              <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, marginTop: 3 }}>
                Sent to HQ · {claim?.claimId}
              </div>
            </div>
          ) : (
            <button
              className="btn-primary"
              onClick={() => setSubmitted(true)}
              style={{ width: '100%', borderRadius: 12, padding: '12px', fontSize: 14 }}
            >
              Send Report to Headquarters
            </button>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>

          {/* View in 3D button */}
          <button
            className="btn-primary"
            onClick={onView3D}
            style={{ width: '100%', padding: '11px', borderRadius: 12, fontSize: 14, fontWeight: 600 }}
          >
            View in 3D
          </button>

          {/* GS viewer */}
          <div style={{ ...CARD, height: 160, overflow: 'hidden', position: 'relative' }}>
            {show3D && splatUrl ? (
              <GaussianViewer splatUrl={splatUrl} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.35)', fontSize: 13,
              }}>
                2D View of GS
              </div>
            )}
          </div>

          {/* Captured frames grid — 4 × 3 */}
          {frames.length > 0 && (
            <div>
              <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Captured · {frames.length}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {frames.slice(0, 12).map((url, i) => (
                  <div
                    key={i}
                    onClick={() => setLightboxIdx(i)}
                    style={{
                      aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
                      background: 'rgba(30,30,40,0.70)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {frames.length === 0 && (
            <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
              No captured images found.<br />Restart task to capture images.
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          onClick={() => setLightboxIdx(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <img
            src={frames[lightboxIdx]}
            alt="frame"
            style={{ maxWidth: '88vw', maxHeight: '82vh', borderRadius: 12, boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ position: 'absolute', top: 20, right: 28, display: 'flex', gap: 10 }}>
            {[
              { label: '←', action: () => setLightboxIdx(i => Math.max(0, i - 1)) },
              { label: '→', action: () => setLightboxIdx(i => Math.min(frames.length - 1, i + 1)) },
              { label: '✕', action: () => setLightboxIdx(null), danger: true },
            ].map(({ label, action, danger }) => (
              <button
                key={label}
                onClick={e => { e.stopPropagation(); action(); }}
                style={{
                  background: danger ? 'rgba(239,68,68,0.30)' : 'rgba(255,255,255,0.12)',
                  border: 'none', borderRadius: 8, color: 'white',
                  padding: '8px 14px', cursor: 'pointer', fontSize: 15,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
