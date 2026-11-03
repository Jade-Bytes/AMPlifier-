/**
 * AMPlifier service worker: makes the installed web app open instantly and work offline for reading.
 * Grades and tasks themselves sync through Firebase (which keeps its own offline cache); this worker
 * only caches the app's files.
 *
 *  - Pages: network first, falling back to the cached app shell when offline.
 *  - Hashed build files (assets/), sounds, icons: cache first — their names change when they change.
 *  - Google Fonts: cache first, so the app keeps its typography offline.
 *  - Everything else (Firebase, Google sign-in, Drive): never touched.
 */
const VERSION = 'amplifier-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const cacheFirst = async request => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(VERSION);
    void cache.put(request, response.clone());
  }
  return response;
};

const networkFirstPage = async request => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(VERSION);
      void cache.put('./index.html', response.clone());
    }
    return response;
  } catch {
    return (await caches.match('./index.html')) ?? (await caches.match('./')) ?? Response.error();
  }
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return; // Firebase, Google sign-in, Drive: straight to network
  if (url.pathname.endsWith('/desktop-auth.html')) return; // sign-in page for the desktop app: always fresh
  if (url.pathname.endsWith('/landing.html')) return; // marketing page: never cached in place of the app shell

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (/\/(assets|sounds|icons)\//.test(url.pathname)) event.respondWith(cacheFirst(request));
});
