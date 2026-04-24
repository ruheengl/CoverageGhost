import { enableXRLayer } from '../lib/enableXRLayer';
import { getColor } from '../lib/coverageColors';

export default function PolicyCitation({ decision, position }) {
  const color = getColor(decision.coverage_status);

  return (
    <div style={{
      position: 'absolute',
      left: position.x, top: position.y,
      width: 220, padding: 12,
      background: 'rgba(15,23,42,0.9)',
      backdropFilter: 'blur(16px)',
      borderRadius: 10,
      border: `1px solid ${color.hex}44`,
      color: 'white', fontFamily: 'Arial',
      ...enableXRLayer({ zOffset: position.z || 0.2 })
    }}>
      <div style={{ fontSize: 11, color: color.hex, fontWeight: 700, marginBottom: 4 }}>
        §{decision.policy_section}  —  {color.label}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{decision.reason}</div>
      {decision.estimated_payout_usd && (
        <div style={{ fontSize: 11, color: '#99f6e4', marginTop: 6 }}>
          Est. ${decision.estimated_payout_usd.min.toLocaleString()}
          –${decision.estimated_payout_usd.max.toLocaleString()}
        </div>
      )}
    </div>
  );
}
