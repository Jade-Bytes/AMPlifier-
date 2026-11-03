import type { CapacitorConfig } from '@capacitor/cli';

/** Android app: wraps the production web build (dist/) in a native shell. See android/README.md. */
const config: CapacitorConfig = {
  appId: 'io.github.jadebytes.amplifier',
  appName: 'AMPlifier',
  webDir: 'dist',
  backgroundColor: '#080c1b',
  plugins: {
    // Only Google sign-in is used; the other providers' SDKs stay out of the APK.
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
      logLevel: 1,
    },
  },
};

export default config;
