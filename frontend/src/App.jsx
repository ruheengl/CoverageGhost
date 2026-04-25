import { useState } from 'react';
import LoginScene from './scenes/LoginScene';
import ScanScene from './scenes/ScanScene';
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
      {scene === 'login' && (
        <LoginScene onLogin={(data) => { setClaim(data); setScene('scan'); }} />
      )}
      {scene === 'scan' && claim && (
        <ScanScene claim={claim}
          onComplete={(damage, coverage, covMap, splat, notes) => {
            setDamageData(damage); setCoverageDecisions(coverage);
            setCoverageMap(covMap); setSplatUrl(splat); setVoiceNotes(notes || []);
            setScene('annotate');
          }} />
      )}
      {scene === 'annotate' && (
        <AnnotateScene claim={claim} damageData={damageData}
          coverageDecisions={coverageDecisions} coverageMap={coverageMap}
          splatUrl={splatUrl} voiceNotes={voiceNotes} onComplete={() => setScene('review')} />
      )}
      {scene === 'review' && (
        <ReviewScene claim={claim} damageData={damageData}
          coverageDecisions={coverageDecisions} splatUrl={splatUrl} />
      )}
    </div>
  );
}
