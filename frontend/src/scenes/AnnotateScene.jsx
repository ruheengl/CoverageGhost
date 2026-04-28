import { useState, useEffect } from 'react';
import StickyNote from '../components/StickyNote';
import GaussianViewer from '../components/GaussianViewer';
import ImmersiveAnnotate from '../components/ImmersiveAnnotate';

const COVERAGE_COLORS = { green: '#34d399', red: '#f87171', amber: '#fbbf24', gray: '#94a3b8' };
const DIR_LABELS = ['Front', 'Front-Right', 'Right', 'Rear-Right', 'Rear', 'Rear-Left', 'Left', 'Front-Left'];

function angleLabel(deg) {
  return `${DIR_LABELS[Math.round(deg / 45) % 8]} — ${Math.round(deg)}°`;
}

export default function AnnotateScene({
  claim,
  damageData,
  coverageDecisions = [],
  splatUrl,
  voiceNotes = [],
  onComplete,
}) {
  const [xrSupported, setXrSupported] = useState(false);
  const [inXR, setInXR] = useState(false);

  useEffect(() => {
    navigator.xr?.isSessionSupported('immersive-ar').then(setXrSupported).catch(() => {});
  }, []);

  const notes = (coverageDecisions || []).map((decision, index) => ({
    name: decision?.area_name || `Area ${index + 1}`,
    description: decision?.reason || 'No annotation details available yet.',
    color: decision?.coverage_status || 'gray',
    policy_section: decision?.policy_section || '',
  }));

  if (inXR) {
    return (
      <ImmersiveAnnotate
        coverageDecisions={coverageDecisions}
        voiceNotes={voiceNotes}
        onComplete={onComplete}
        onExit={() => setInXR(false)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#0e0f13', color: 'white' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <GaussianViewer splatUrl={splatUrl} />
      </div>

      <div style={{
        position: 'relative', zIndex: 1, padding: '20px 24px',
        display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'center',
      }}>
        {/* Coverage annotations panel */}
        <div style={{
          width: 320, padding: '18px 18px 16px',
          borderRadius: 16,
          background: 'rgba(22,24,30,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Annotation Review</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Coverage Summary</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
            Claim {claim?.claimId || '—'} · {notes.length} area{notes.length !== 1 ? 's' : ''}
          </div>
          {notes.map((note, i) => (
            <div key={i} style={{
              marginBottom: 6, padding: '9px 11px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              borderLeft: `3px solid ${COVERAGE_COLORS[note.color] || '#64748b'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: COVERAGE_COLORS[note.color] || '#64748b', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 12 }}>{note.name}</span>
                {note.policy_section && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>§{note.policy_section}</span>}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, paddingLeft: 12 }}>{note.description}</div>
            </div>
          ))}
          {notes.length === 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>No coverage data</div>
          )}

          {xrSupported && (
            <button
              onClick={() => setInXR(true)}
              style={{
                marginTop: 12, padding: '12px 16px', border: 'none', borderRadius: 10,
                background: '#1a3ecf',
                color: 'white', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', width: '100%', marginBottom: 8,
              }}
            >
              View in AR
            </button>
          )}
          <button
            onClick={onComplete}
            style={{
              marginTop: xrSupported ? 0 : 12, padding: '12px 16px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', width: '100%',
            }}
          >
            Continue to Summary
          </button>
        </div>

        {/* Voice notes sidebar */}
        {voiceNotes.length > 0 && (
          <div style={{
            width: 230, padding: '14px 14px 12px',
            borderRadius: 16,
            background: 'rgba(22,24,30,0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Field Notes</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              Voice Logs
              <span style={{
                background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', borderRadius: 20,
                padding: '1px 8px', fontSize: 11, fontWeight: 600,
              }}>
                {voiceNotes.length}
              </span>
            </div>
            {voiceNotes.map((note, i) => (
              <div key={i} style={{
                marginBottom: 7, padding: '7px 9px', borderRadius: 9,
                background: 'rgba(255,255,255,0.04)',
                borderLeft: '2px solid rgba(255,255,255,0.2)',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {angleLabel(note.angle)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>{note.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky note overlays — web view only, no AR stickies */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {notes.slice(0, 6).map((note, index) => (
          <StickyNote
            key={`${note.name}-${index}`}
            area={note}
            position={{ x: `${8 + (index % 4) * 22}%`, y: `${15 + Math.floor(index / 4) * 22}%`, z: 0.3 }}
            onDismiss={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
