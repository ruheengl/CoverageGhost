// Full-screen background image — uses the hero.png asset already in the project
// or falls back to a CSS-rendered dark industrial look
import hero from '../assets/hero.png';

export default function AppBackground() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0,
      backgroundImage: `url(${hero})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      {/* Subtle darkening overlay so panels read clearly */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.18)',
      }} />
    </div>
  );
}
