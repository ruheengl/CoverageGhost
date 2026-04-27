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
    <div style={{ minHeight: '100vh', position: 'relative', background: '#020617', color: 'white' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <GaussianViewer
          splatUrl={splatUrl}
          spatialNotes={voiceNotes}
          onNoteRedo={() => alert('Re-scan this area to add a new note.')}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
        {/* Coverage annotations panel */}
        <div style={{ maxWidth: 380, padding: 20, borderRadius: 16, background: 'rgba(15,23,42,0.62)', backdropFilter: 'blur(12px)' }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Annotation Review</div>
          <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 16 }}>
            Claim {claim?.claimId || 'Unknown'} · {notes.length} coverage area{notes.length !== 1 ? 's' : ''}
          </div>
          {notes.map((note, i) => (
            <div key={i} style={{
              marginBottom: 10, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              borderLeft: `3px solid ${COVERAGE_COLORS[note.color] || '#94a3b8'}`,
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{note.name}</div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>{note.description}</div>
            </div>
          ))}
          {notes.length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.4, marginBottom: 12 }}>No coverage data</div>
          )}

          {xrSupported && (
            <button
              onClick={() => setInXR(true)}
              style={{
                marginTop: 12, padding: '12px 18px', border: 'none', borderRadius: 10,
                background: 'linear-gradient(135deg, #0d9488, #0891b2)',
                color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', width: '100%', marginBottom: 8,
              }}
            >
              View in AR
            </button>
          )}
          <button
            onClick={onComplete}
            style={{
              marginTop: xrSupported ? 0 : 12, padding: '12px 18px', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10, background: 'rgba(255,255,255,0.07)',
              color: 'white', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', width: '100%',
            }}
          >
            Continue to Summary
          </button>
        </div>

        {/* Voice notes sidebar */}
        <div style={{
          minWidth: 270, maxWidth: 310, padding: 16, borderRadius: 16,
          background: 'rgba(15,23,42,0.62)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(251,191,36,0.2)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            Field Notes
            {voiceNotes.length > 0 && (
              <span style={{
                background: '#fbbf24', color: '#020617', borderRadius: 20,
                padding: '1px 8px', fontSize: 11, fontWeight: 700,
              }}>
                {voiceNotes.length}
              </span>
            )}
          </div>
          {voiceNotes.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.35 }}>No voice notes captured</div>
          ) : (
            voiceNotes.map((note, i) => (
              <div key={i} style={{
                marginBottom: 10, padding: '8px 10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                borderLeft: '3px solid #fbbf24',
              }}>
                <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {angleLabel(note.angle)}
                </div>
                <div style={{ fontSize: 13 }}>{note.text}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {notes.map((note, index) => (
          <StickyNote
            key={`${note.name}-${index}`}
            area={note}
            position={{ x: `${10 + (index % 3) * 28}%`, y: `${18 + index * 16}%`, z: 0.3 }}
            onDismiss={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
