import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export function renderPath(pathname = "/"): string {
  return renderToString(<React.StrictMode><App server initialPath={pathname} /></React.StrictMode>);
}

export const renderHome = () => renderPath("/");
