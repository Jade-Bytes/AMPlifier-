import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './lib/serviceWorker';
import './styles/tokens.css';
import './styles/app.css';
import './styles/screens.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
registerServiceWorker();
