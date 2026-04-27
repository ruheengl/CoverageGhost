import { useState } from 'react';
import GaussianViewer from '../components/GaussianViewer';

const STATUS_COLORS = { green: '#34d399', red: '#f87171', amber: '#fbbf24', gray: '#94a3b8' };

export default function ReviewScene({ claim, damageData, coverageDecisions = [], splatUrl }) {
  const [submitted, setSubmitted] = useState(false);
  const covered = coverageDecisions.filter(d => d.coverage_status === 'green').length;
  const notCovered = coverageDecisions.filter(d => d.coverage_status === 'red').length;
  const partial = coverageDecisions.filter(d => d.coverage_status === 'amber').length;

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: 'white', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <GaussianViewer splatUrl={splatUrl} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: 24, display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{
          width: 460, padding: 24, borderRadius: 18,
          background: 'rgba(15,23,42,0.62)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Claim Summary</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
            {claim?.claimId || 'Unknown'} · {claim?.adjuster || 'Unknown adjuster'}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Covered', count: covered, color: '#34d399' },
              { label: 'Not Covered', count: notCovered, color: '#f87171' },
              { label: 'Partial', count: partial, color: '#fbbf24' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', textAlign: 'center',
                border: `1px solid ${color}30`,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 16 }} />

          <div style={{ display: 'grid', gap: 8, marginBottom: 20, maxHeight: '45vh', overflowY: 'auto' }}>
            {coverageDecisions.map((d, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${STATUS_COLORS[d.coverage_status] || '#94a3b8'}`,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.area_name || `Area ${i + 1}`}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  {d.reason || 'No reason provided.'}
                </div>
              </div>
            ))}
            {coverageDecisions.length === 0 && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No coverage data.</div>
            )}
          </div>

          {submitted ? (
            <div style={{
              padding: '16px', borderRadius: 12, background: 'rgba(13,148,136,0.15)',
              border: '1px solid rgba(52,211,153,0.3)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#34d399', marginBottom: 4 }}>Report Submitted</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                PDF will be generated and sent to HQ · {claim?.claimId}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSubmitted(true)}
              style={{
                width: '100%', padding: '13px', background: '#0d9488', border: 'none',
                borderRadius: 12, color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Submit Claim Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
