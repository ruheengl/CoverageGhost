import { useState } from 'react';
const inWebSpatial = /WebSpatial\//.test(navigator.userAgent);
import LoginScene from './scenes/LoginScene';
import CameraBackground from './components/CameraBackground';
import ScanScene from './scenes/ScanScene';
import ImmersiveViewer from './components/ImmersiveViewer';
import AnnotateScene from './scenes/AnnotateScene';
import ReviewScene from './scenes/ReviewScene';
import './index.css';

export default function App() {
  const [scene, setScene] = useState('login');
  const [claim, setClaim] = useState(null);
  const [damageData, setDamageData] = useState(null);
  const [coverageDecisions, setCoverageDecisions] = useState([]);
  const [coverageMap, setCoverageMap] = useState({});
  const [splatUrl, setSplatUrl] = useState(null);
  const [voiceNotes, setVoiceNotes] = useState([]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {!inWebSpatial && <CameraBackground active />}
      {scene === 'login' && (
        <LoginScene onLogin={(data) => { setClaim(data); setScene('scan'); }} />
      )}
      {scene === 'scan' && claim && (
        <ScanScene claim={claim}
          onComplete={(damage, coverage, covMap, splat, notes) => {
            setDamageData(damage); setCoverageDecisions(coverage);
            setCoverageMap(covMap); setSplatUrl(splat); setVoiceNotes(notes || []);
            setScene('splat-view');
          }} />
      )}
      {scene === 'splat-view' && (
        <ImmersiveViewer
          splatUrl={splatUrl}
          damageData={damageData}
          onComplete={() => setScene('annotate')}
          onExit={() => setScene('annotate')}
        />
      )}
      {scene === 'annotate' && (
        <AnnotateScene claim={claim} damageData={damageData}
          coverageDecisions={coverageDecisions} coverageMap={coverageMap}
          splatUrl={splatUrl} voiceNotes={voiceNotes}
          onComplete={() => setScene('review')} />
      )}
      {scene === 'review' && (
        <ReviewScene claim={claim} damageData={damageData}
          coverageDecisions={coverageDecisions} splatUrl={splatUrl} />
      )}
    </div>
  );
}
