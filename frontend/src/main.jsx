import { createRoot } from 'react-dom/client';
import { WebSpatialProvider } from '@webspatial/react-sdk';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <WebSpatialProvider>
    <App />
  </WebSpatialProvider>
);