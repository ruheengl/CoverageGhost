import { enableXRLayer } from '../lib/enableXRLayer';
import { getColor } from '../lib/coverageColors';

const STATUS_DOT = { green: '#30d158', red: '#ff453a', amber: '#ffd60a', gray: '#636366' };

export default function StickyNote({ area, position, onDismiss }) {
  const color = getColor(area.color || 'gray');
  const dot = STATUS_DOT[area.color] || STATUS_DOT.gray;

  return (
    <div style={{
      position: 'absolute', left: position.x, top: position.y,
      width: 160, padding: '9px 11px',
      background: 'rgba(22,24,30,0.90)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.09)',
      color: 'white', fontFamily: 'inherit',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      ...enableXRLayer({ zOffset: position.z || 0.3 })
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'white' }}>
          {area.name}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: area.policy_section ? 4 : 0, lineHeight: 1.4 }}>
        {area.description}
      </div>
      {area.policy_section && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>§{area.policy_section}</div>
      )}
      <div style={{ fontSize: 9, color: dot, fontWeight: 600, marginTop: 4 }}>{color.label}</div>
    </div>
  );
}
