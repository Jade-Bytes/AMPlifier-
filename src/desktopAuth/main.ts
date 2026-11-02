/**
 * Browser half of the desktop app's Google sign-in (see desktop/main.cjs).
 *
 * The AMPlifier desktop app opens this page — normally on the official website — in the student's
 * default browser with a one-time `state` and the app's local `port`. The student signs in with Google
 * here, in their real browser with their accounts, and the page hands the Google credential back to
 * the app at http://localhost:<port> (the app only accepts it from this site, with that state, once). The Firebase session on this
 * page lives in memory only and is signed out immediately, so nothing stays signed in to the browser.
 */
import { initializeApp } from 'firebase/app';
import { browserPopupRedirectResolver, GoogleAuthProvider, inMemoryPersistence, initializeAuth, signInWithPopup, signOut } from 'firebase/auth';
import '../styles/tokens.css';
import './desktopAuth.css';

const root = document.getElementById('root')!;
const params = new URLSearchParams(location.search);
const state = params.get('state') ?? '';
const scopes = (params.get('scopes') ?? '').split(' ').filter(scope => /^https:\/\/www\.googleapis\.com\/auth\/[\w.]+$/.test(scope));
const wantsDrive = scopes.some(scope => scope.endsWith('/drive.file'));

// Must match OFFICIAL_SITE_ORIGIN and the port list in desktop/main.cjs.
const OFFICIAL_SITE_ORIGIN = 'https://jade-bytes.github.io';
const APP_PORTS = ['47821', '47822', '47823', '47824'];
const servedByApp = /^localhost(:\d+)?$/.test(location.host);
const appPort = params.get('port') ?? (servedByApp ? location.port : '');
const completeUrl = servedByApp ? '/desktop-auth/complete' : `http://localhost:${appPort}/desktop-auth/complete`;

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const mark = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 14.5h3.2l2.1-5.2 3.6 9.2 3-12.2 2.4 8.2h4.7"/></svg></span>`;
const googleLogo = `<svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9a11.1 11.1 0 0 1-4.78 7.29l7.73 6c4.51-4.18 7.13-10.33 7.13-17.76Z"/><path fill="#FBBC05" d="M10.54 28.59A14.44 14.44 0 0 1 9.75 24c0-1.59.28-3.13.78-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.89.93 7.57 2.56 10.78l7.98-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.79l-7.73-6c-2.14 1.44-4.87 2.29-8.17 2.29-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>`;

function render(view: { title: string; body: string; action?: string; tone?: 'done' | 'error' }) {
  root.innerHTML = `<section class="desktop-auth-card ${view.tone ? `is-${view.tone}` : ''}">
    <header>${mark}<span class="brand-word">amp<span>lifier</span></span></header>
    <h1>${view.title}</h1>
    <p>${view.body}</p>
    ${view.action ?? ''}
  </section>`;
}

class AppUnreachable extends Error {}

/** Sends the result to the desktop app. Resolves false if the app says this sign-in has expired. */
async function report(body: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch(completeUrl, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, ...body }) });
  } catch {
    // App closed, or the browser declined to let this site reach an app on the device.
    throw new AppUnreachable('Couldn’t reach the AMPlifier app. Make sure it’s still open — and if your browser asks whether this site may connect to apps on your device, choose Allow. Then try again.');
  }
  return response.ok;
}

function friendly(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google window. Allow pop-ups for this page, then try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'The Google window was closed before sign-in finished.';
  if (code === 'auth/network-request-failed') return 'Could not reach Google. Check your connection and try again.';
  if (code === 'auth/unauthorized-domain') return `This sign-in page is not authorized in Firebase. Add “${location.hostname}” under Authentication → Settings → Authorized domains.`;
  return error instanceof Error ? error.message : 'Sign-in did not finish. Try again.';
}

function showReady(message?: string) {
  render({
    title: wantsDrive ? 'Connect Google Drive' : 'Sign in to AMPlifier',
    body: message ?? (wantsDrive
      ? 'Choose the same Google account you use in AMPlifier. AMPlifier only sees files it creates in your Drive.'
      : 'Choose your Google account. You’ll go straight back to the AMPlifier app when you’re done.'),
    tone: message ? 'error' : undefined,
    action: `<button class="google-button" id="go">${googleLogo}<span>Continue with Google</span></button>`,
  });
  document.getElementById('go')!.addEventListener('click', () => void signIn());
}

async function signIn() {
  const button = document.getElementById('go') as HTMLButtonElement | null;
  if (button) { button.disabled = true; button.querySelector('span')!.textContent = 'Waiting for Google…'; }
  const app = initializeApp(config, `desktop-auth-${Date.now()}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    scopes.forEach(scope => provider.addScope(scope));
    // Called straight from the click, so the browser treats the Google window as user-initiated.
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.idToken) throw new Error('Google did not return a sign-in token. Try again.');
    const delivered = await report({ idToken: credential.idToken, accessToken: credential.accessToken ?? '' });
    await signOut(auth).catch(() => undefined);
    if (!delivered) {
      render({ title: 'This sign-in link has expired', body: 'Go back to AMPlifier and choose “Continue with Google” again.', tone: 'error' });
      return;
    }
    render({
      title: wantsDrive ? 'Google Drive connected' : 'You’re signed in',
      body: 'Return to the AMPlifier app — it’s ready for you. You can close this tab.',
      tone: 'done',
    });
  } catch (error) {
    await signOut(auth).catch(() => undefined);
    showReady(error instanceof AppUnreachable ? error.message : friendly(error));
  }
}

if (!(servedByApp || location.origin === OFFICIAL_SITE_ORIGIN) || state.length < 20 || !APP_PORTS.includes(appPort)) {
  render({ title: 'Open sign-in from the app', body: 'This page finishes signing in for the AMPlifier desktop app. Start from “Continue with Google” in the app.', tone: 'error' });
} else if (!config.apiKey) {
  render({ title: 'Sign-in is not configured', body: 'This build of AMPlifier has no Firebase settings.', tone: 'error' });
} else {
  showReady();
}
