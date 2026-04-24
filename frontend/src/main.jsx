import { createRoot } from 'react-dom/client';
import { SSRProvider } from '@webspatial/react-sdk';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <SSRProvider>
    <App />
  </SSRProvider>
);
