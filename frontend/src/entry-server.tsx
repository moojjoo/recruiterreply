import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export function renderHome(): string {
  return renderToString(<React.StrictMode><App server /></React.StrictMode>);
}
