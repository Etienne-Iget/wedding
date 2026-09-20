import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the PWA service worker only in production — in dev the virtual
// module may not resolve and would break the preview.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
