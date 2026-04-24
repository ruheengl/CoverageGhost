import StickyNote from '../components/StickyNote';
import GaussianViewer from '../components/GaussianViewer';

export default function AnnotateScene({
  claim,
  damageData,
  coverageDecisions = [],
  splatUrl,
  onComplete,
}) {
  const notes = coverageDecisions.map((decision, index) => ({
    name: decision.area_name || `Area ${index + 1}`,
    description: decision.reason || 'No annotation details available yet.',
    color: decision.coverage_status || 'gray',
    policy_section: decision.policy_section,
  }));

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#020617', color: 'white' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <GaussianViewer splatUrl={splatUrl} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: 24 }}>
        <div style={{ maxWidth: 420, padding: 20, borderRadius: 16, background: 'rgba(15,23,42,0.82)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Annotation Review</div>
          <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 12 }}>
            Claim {claim?.claimId || 'Unknown'} with {notes.length} coverage annotations.
          </div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            {damageData ? 'Damage data loaded and ready for review.' : 'No damage data available yet.'}
          </div>
          <button
            onClick={onComplete}
            style={{
              marginTop: 16,
              padding: '12px 18px',
              border: 'none',
              borderRadius: 10,
              background: '#0d9488',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Continue to Summary
          </button>
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
