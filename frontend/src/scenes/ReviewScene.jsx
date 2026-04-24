import GaussianViewer from '../components/GaussianViewer';

export default function ReviewScene({ claim, damageData, coverageDecisions = [], splatUrl }) {
  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: 'white', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <GaussianViewer splatUrl={splatUrl} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: 24 }}>
        <div style={{ maxWidth: 520, padding: 24, borderRadius: 18, background: 'rgba(15,23,42,0.85)' }}>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Claim Summary</div>
          <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
            {claim?.claimId || 'Unknown claim'} reviewed by {claim?.adjuster || 'Unknown adjuster'}
          </div>
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            Damage areas analyzed: {damageData?.damaged_areas?.length ?? coverageDecisions.length}
          </div>
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            Coverage decisions returned: {coverageDecisions.length}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {coverageDecisions.map((decision, index) => (
              <div
                key={`${decision.area_name || 'area'}-${index}`}
                style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}
              >
                <div style={{ fontWeight: 700 }}>{decision.area_name || `Area ${index + 1}`}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>{decision.coverage_status || 'Unknown status'}</div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>{decision.reason || 'No reason provided.'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
