import { Capacitor } from '@capacitor/core';

/**
 * Registers public/sw.js so the website can be installed to a phone's home screen and opens offline.
 * Production web builds only: development needs fresh files on every change, and the desktop app
 * (Electron) and Android app (Capacitor) ship their files locally already.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || window.desktopApp || Capacitor.isNativePlatform()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Not fatal: the app works the same without offline support.
    });
  });
}
