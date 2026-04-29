import { enableXRLayer } from '../lib/enableXRLayer';
import { getColor } from '../lib/coverageColors';

export default function StickyNote({ area, position, onDismiss }) {
  const color = getColor(area.color || 'gray');
  const borderColor = area.color === 'red' ? '#ef4444' : '#f59e0b';

  return (
    <div style={{
      position: 'absolute', left: position.x, top: position.y,
      width: 260, padding: 16,
      background: 'rgba(15,23,42,0.85)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12, borderLeft: `4px solid ${borderColor}`,
      color: 'white', fontFamily: 'Arial',
      ...enableXRLayer({ zOffset: position.z || 0.3 })
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{area.name}</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>{area.description}</div>
      {area.policy_section && (
        <div style={{ fontSize: 11, color: '#1a3cef', marginBottom: 6 }}>
          Policy §{area.policy_section}
        </div>
      )}
      <div style={{ fontSize: 11, color: color.hex, fontWeight: 600 }}>{color.label}</div>
      <button onClick={onDismiss}
        style={{ marginTop: 8, fontSize: 11, background: 'transparent',
          border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
          color: 'white', padding: '2px 8px', cursor: 'pointer' }}>
        Dismiss
      </button>
    </div>
  );
}
