import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { registerServiceWorker } from './lib/serviceWorker';
import './styles/tokens.css';
import './styles/app.css';
import './styles/screens.css';

if (Capacitor.isNativePlatform()) document.documentElement.dataset.native = Capacitor.getPlatform();

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
registerServiceWorker();
