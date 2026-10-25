import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installGlobalTelemetryHandlers } from './services/telemetry';

installGlobalTelemetryHandlers();

const root = document.getElementById('root')!;
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
if (window.location.pathname === '/' && root.dataset.prerendered === 'react') {
  ReactDOM.hydrateRoot(root, app);
} else {
  ReactDOM.createRoot(root).render(app);
}
