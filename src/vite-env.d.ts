/// <reference types="vite/client" />

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
