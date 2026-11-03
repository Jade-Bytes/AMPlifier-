/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Firebase project's Google "Web application" OAuth client ID, used by the Android app's native sign-in. */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string;
}

/** Result of a Google sign-in completed in the system browser by the desktop app. */
type DesktopSignInResult =
  | { ok: true; idToken: string; accessToken?: string }
  | { ok: false; reason: 'cancelled' | 'timeout' | 'error'; message?: string };

/** Bridge exposed by desktop/preload.cjs when AMPlifier runs as the desktop app. */
interface Window {
  desktopApp?: {
    isDesktop: true;
    platform: string;
    version: string;
    signInWithGoogle?: (scopes?: string[]) => Promise<DesktopSignInResult>;
    cancelSignIn?: () => Promise<void>;
  };
}
