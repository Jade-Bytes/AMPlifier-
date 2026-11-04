import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { BAR, BEAT } from '../beats';
import { SITE } from '../data';
import { C, enter, fontBody, fontDisplay, rise } from '../theme';

/** Frames here count from the start of the close: the final chord lands one bar in. */
export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = enter(frame, 0, 18);
  const chord = frame >= BAR ? Math.exp(-(frame - BAR) / 18) : 0;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: `radial-gradient(1500px 900px at 50% 50%, rgba(5,8,26,${0.92 - chord * 0.16}), rgba(5,8,26,.62) 78%)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30, opacity: logo, transform: logo < 1 ? `perspective(1400px) rotateX(${(1 - logo) * 36}deg) scale(${0.86 + logo * 0.14})` : 'none' }}>
        <Img src={staticFile('app/icon.png')} style={{ width: 128, height: 128, borderRadius: 30, boxShadow: `0 0 ${50 + chord * 90}px ${C.gainGlow}` }} />
        <span style={{ font: `800 124px/1 ${fontDisplay}`, letterSpacing: '-.03em', color: C.text }}>AMPlifier</span>
      </div>
      <div style={{ ...rise(frame, BEAT, 30, 16), marginTop: 40, font: `800 96px/1.06 ${fontDisplay}`, letterSpacing: '-.03em', color: C.text }}>
        Know your grade before<br />the report card does.
      </div>
      <div style={{ ...rise(frame, BAR, 18, 12), marginTop: 46, font: `800 82px/1.1 ${fontDisplay}`, letterSpacing: '-.02em', backgroundImage: C.gradSignal, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', padding: '0 12px' }}>
        Free. Download now.
      </div>
      <div style={{ ...rise(frame, BAR + BEAT, 14, 12), marginTop: 24, font: `700 58px/1.1 ${fontBody}`, color: C.text }}>{SITE}</div>
    </AbsoluteFill>
  );
};
