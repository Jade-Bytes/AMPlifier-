# AMPlifier for Android

The Android app is the production web build (`dist/`) inside a [Capacitor](https://capacitorjs.com) shell. One universal APK runs on phones, foldables and tablets (Android 7.0 / API 24 and newer, any screen size or orientation). Under 720px wide the app uses the phone layout with the bottom tab bar; wider screens, such as tablets and landscape phones, get the full sidebar layout.

## Build

You need JDK 21 and the Android SDK (platform 36, build-tools 36). Android Studio installs both, or use the command-line tools and point `android/local.properties` at the SDK:

```properties
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
```

Then, from the repo root:

| Script | Output |
|---|---|
| `npm run android:build` | Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run android:release` | Signed release APK: `android/app/build/outputs/apk/release/app-release.apk` |
| `npm run android:sync` | Rebuilds the web app and copies it into the Android project (then open `android/` in Android Studio) |

Both builds bundle the web app from `.env.production`, so they talk to the production Firebase project.

## Release signing

Release builds are signed with the key named in `android/keystore.properties` (not committed):

```properties
storeFile=C:/Users/<you>/.android/amplifier-release.jks
storePassword=…
keyAlias=amplifier
keyPassword=…
```

Without that file, `android:release` produces an unsigned APK that will not install. **Back up the keystore and its passwords.** Android only installs updates signed with the same key, so losing it means users must uninstall and reinstall.

## Google sign-in

Google blocks its sign-in page inside app WebViews, so the app signs in with the device's Google accounts (Credential Manager, via `@capgo/capacitor-social-login`) and passes the Google credential to Firebase. Two things must be set up in the Firebase project:

1. `VITE_GOOGLE_WEB_CLIENT_ID` in `.env.production` is the project's **Web application** OAuth client ID (Google Cloud Console → APIs & Services → Credentials, "Web client (auto created by Google Service)").
2. Google must recognise the app: Firebase console → Project settings → Your apps → **Add app → Android**, package name `io.github.jadebytes.amplifier`, and add the SHA-1 of every key you sign with. This creates the Android OAuth client. You do not need to add `google-services.json` to the project.

Get the SHA-1 of a key with:

```sh
keytool -list -v -keystore <keystore> -alias <alias>
```

The debug key is `~/.android/debug.keystore` (alias `androiddebugkey`, password `android`), and each computer has its own debug key.

If sign-in fails with "Developer console is not set up correctly", the package name or SHA-1 of the installed APK is not registered. `adb logcat -s GoogleProvider` prints both. Changes in Google Cloud can take a few minutes to apply. If the OAuth consent screen is in Testing mode, add the Google accounts that will sign in as test users.

Connecting Google Drive asks for the `drive.file` permission with Google's consent screen; `MainActivity` hands its result back to the sign-in plugin.

## App icon and launch screen

`npx electron scripts/render-android-icons.cjs` redraws the launcher icons in `android/app/src/main/res/mipmap-*` from the brand mark. The launch screen shows the adaptive icon on the app background (`res/values/styles.xml`).
