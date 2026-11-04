import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SampleLabel } from '../components';
import { C, enter, fontBody, fontDisplay, rise } from '../theme';

const Platform: React.FC<{ name: string; how: string; step?: React.ReactNode }> = ({ name, how, step }) => {
  const frame = useCurrentFrame();
  const slide = enter(frame, 0, 12);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(5,8,26,.9) 0%, rgba(5,8,26,.7) 34%, rgba(5,8,26,0) 56%)' }} />
      <SampleLabel />
      <div style={{ position: 'absolute', left: 84, top: 190, width: 760, transform: `translateX(${(1 - slide) * -70}px)`, opacity: slide }}>
        <div style={{ font: `800 104px/1 ${fontDisplay}`, letterSpacing: '-.035em', color: C.text, textWrap: 'balance', textShadow: `0 0 40px ${C.signalGlow}` }}>{name}</div>
        <div style={{ ...rise(frame, 4, 18, 10), marginTop: 30, font: `500 58px/1.18 ${fontBody}`, color: C.text }}>{how}</div>
        {step ? <div style={{ ...rise(frame, 12, 16, 10), marginTop: 34 }}>{step}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 84, bottom: 44, display: 'flex', alignItems: 'center', gap: 18, font: `500 42px/1 ${fontBody}`, color: C.text }}>
        <span style={{ width: 18, height: 18, borderRadius: 9, background: C.signal, boxShadow: `0 0 20px ${C.signal}` }} />
        Sign in with Google. Your workspace syncs.
      </div>
    </AbsoluteFill>
  );
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'inline-block', padding: '16px 26px', borderRadius: 16, background: C.glassStrong, border: `3px solid ${C.signal}`, font: `700 42px/1.1 ${fontBody}`, color: C.text, boxShadow: `0 0 30px ${C.signalGlow}` }}>{children}</div>
);

export const Android: React.FC = () => <Platform name="Android phones and tablets" how="Download the APK from the website." step={<Chip>AMPlifier-Android.apk</Chip>} />;
export const Windows: React.FC = () => <Platform name="Windows 10 and 11" how="Download the installer from the website." step={<Chip>AMPlifier-Windows-Setup.exe</Chip>} />;
export const Apple: React.FC = () => <Platform name="iPhone and iPad" how="Open the web app in Safari, then Add to Home Screen." step={<Chip>Add to Home Screen</Chip>} />;
export const Browser: React.FC = () => <Platform name="Mac, Chromebook and Linux" how="Open it in the browser. Nothing to install." />;

/** Every device gathers into one row, with the sync signal running beneath them. */
export const Sync: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(0deg, rgba(5,8,26,.92) 0%, rgba(5,8,26,.7) 30%, rgba(5,8,26,0) 52%)' }} />
      <SampleLabel />
      <div style={{ position: 'absolute', left: 120, right: 120, bottom: 44, textAlign: 'center' }}>
        <div style={{ ...rise(frame, 0, 34, 10), font: `800 122px/1 ${fontDisplay}`, letterSpacing: '-.035em', color: C.text, textShadow: `0 0 50px ${C.signalGlow}` }}>Every platform</div>
        <div style={{ ...rise(frame, 4, 18, 10), marginTop: 24, font: `500 62px/1.16 ${fontBody}`, color: C.text, textWrap: 'balance' }}>Sign in with Google and your workspace syncs across devices.</div>
      </div>
    </AbsoluteFill>
  );
};
