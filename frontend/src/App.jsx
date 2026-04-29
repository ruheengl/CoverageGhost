import { useState } from 'react';
const inWebSpatial = /WebSpatial\//.test(navigator.userAgent);
import LoginScene from './scenes/LoginScene';
import CameraBackground from './components/CameraBackground';
import ScanScene from './scenes/ScanScene';
import ImmersiveViewer from './components/ImmersiveViewer';
import ReviewScene from './scenes/ReviewScene';
import './index.css';

export default function App() {
  const [scene, setScene] = useState('login');
  const [claim, setClaim] = useState(null);
  const [damageData, setDamageData] = useState(null);
  const [coverageDecisions, setCoverageDecisions] = useState([]);
  const [splatUrl, setSplatUrl] = useState(null);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!inWebSpatial && <CameraBackground active />}
      {scene === 'login' && (
        <LoginScene onLogin={(data) => { setClaim(data); setScene('scan'); }} />
      )}
      {scene === 'scan' && claim && (
        <ScanScene claim={claim}
          onComplete={(damage, coverage, covMap, splat, notes) => {
            void covMap;
            void notes;
            setDamageData(damage); setCoverageDecisions(coverage);
            setSplatUrl(splat);
            setScene('review');
          }} />
      )}
      {scene === 'splat-view' && (
        <ImmersiveViewer
          splatUrl={splatUrl}
          damageData={damageData}
          onComplete={() => setScene('review')}
          onExit={() => setScene('review')}
        />
      )}
      {scene === 'review' && (
        <ReviewScene claim={claim} damageData={damageData}
          coverageDecisions={coverageDecisions} splatUrl={splatUrl}
          onView3D={() => setScene('splat-view')} />
      )}
    </div>
  );
}
