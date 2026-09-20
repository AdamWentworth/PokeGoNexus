// index.tsx

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initPerfPaintObservers } from './utils/perfTelemetry';
import { createScopedLogger } from './utils/logger';
import { hasActiveStoredSession } from './utils/storage';
import { applyStoredThemePreferenceToDocument } from './utils/theme';
import { registerAppServiceWorker } from './utils/serviceWorker';
import { receiverContract } from '@shared-contracts/receiver';
import './styles/tokens.css';
import './index.css';

const log = createScopedLogger('index');

document.addEventListener('contextmenu', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest('img')) {
    event.preventDefault();
  }
});

const shouldRegisterServiceWorker =
  'serviceWorker' in navigator &&
  import.meta.env.VITE_DISABLE_SERVICE_WORKER !== 'true';
const shouldDisableServiceWorker =
  'serviceWorker' in navigator &&
  import.meta.env.VITE_DISABLE_SERVICE_WORKER === 'true';

if (shouldRegisterServiceWorker) {
  window.addEventListener('load', () => {
    registerAppServiceWorker({
      version: import.meta.env.VITE_SERVICE_WORKER_VERSION,
      receiverApiUrl: import.meta.env.VITE_RECEIVER_API_URL,
      receiverBatchedUpdatesPath: receiverContract.endpoints.batchedUpdates,
      isLoggedIn: hasActiveStoredSession(),
    })
      .then((registration) => {
        if (!registration) {
          log.debug('Service Worker registration skipped by browser');
          return;
        }

        log.debug('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        log.error('Service Worker registration failed:', error);
      });
  });
}

if (shouldDisableServiceWorker) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => {
      log.error('Service Worker unregister failed:', error);
    });
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container not found');
}

applyStoredThemePreferenceToDocument();

const root = createRoot(container);
root.render(<App />);

initPerfPaintObservers();

reportWebVitals();
