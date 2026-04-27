import { useState } from 'react';

const DIR_LABELS = ['Front', 'Front-Right', 'Right', 'Rear-Right', 'Rear', 'Rear-Left', 'Left', 'Front-Left'];
function angleLabel(deg) {
  return `${DIR_LABELS[Math.round(deg / 45) % 8]} — ${Math.round(deg)}°`;
}

const btnBase = {
  border: 'none', borderRadius: 6, padding: '5px 10px',
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
};

export default function SpatialNotePin({ note, onRedo }) {
  const [playing, setPlaying] = useState(false);

  function handleListen() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(note.text);
    utt.onend = () => setPlaying(false);
    utt.onerror = () => setPlaying(false);
    setPlaying(true);
    synth.speak(utt);
  }

  return (
    <div style={{
      background: 'rgba(15,23,42,0.65)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(251,191,36,0.4)',
      borderRadius: 10,
      padding: '10px 12px',
      minWidth: 180,
      maxWidth: 240,
      color: 'white',
      fontSize: 12,
      userSelect: 'none',
    }}>
      <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
        {angleLabel(note.angle)}
      </div>
      <div style={{ marginBottom: 10, lineHeight: 1.5 }}>
        {note.text || '(no transcript)'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleListen}
          disabled={playing}
          style={{ ...btnBase, background: playing ? '#92400e' : '#fbbf24', color: '#0f172a', opacity: playing ? 0.7 : 1 }}
        >
          {playing ? 'Playing…' : 'Listen'}
        </button>
        <button
          onClick={() => onRedo(note.id)}
          style={{ ...btnBase, background: 'transparent', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' }}
        >
          Redo
        </button>
      </div>
    </div>
  );
}
