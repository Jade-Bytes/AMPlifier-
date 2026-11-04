import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CUE, EIGHTH } from '../beats';
import { SampleLabel } from '../components';
import { SUBJECTS, TARGET, generalAverage } from '../data';
import { C, enter, fontBody, fontDisplay, rise } from '../theme';
import { METER_BASE, TARGET_LEVEL, landingFrame, levelY, project, stripX } from '../world/layout';

const Headline: React.FC<{ children: React.ReactNode; style: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300, textAlign: 'center' }}>
    <div style={{ font: `750 124px/1.05 ${fontDisplay}`, letterSpacing: '-.03em', color: C.text, textShadow: `0 0 60px ${C.signalGlow}`, ...style }}>{children}</div>
  </AbsoluteFill>
);

export const Tension: React.FC = () => {
  const frame = useCurrentFrame();
  const first = rise(frame, 48, 20, 24);
  const firstOut = 1 - enter(frame, CUE.tensionQuestion - 12, 10);
  return (
    <>
      <Headline style={{ ...first, opacity: first.opacity * firstOut }}>The report card is coming.</Headline>
      <Headline style={rise(frame, CUE.tensionQuestion, 20, 20)}>Do you know your grade?</Headline>
    </>
  );
};

/** Grades and names pinned to the 3D meters, so they stay sharp while the camera moves. */
const PinnedLabels: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {SUBJECTS.map((subject, i) => {
      const start = landingFrame(i);
      const top = project(frame, stripX(i), levelY(1) + 0.34, 0.2);
      const base = project(frame, stripX(i), METER_BASE - 0.32, 0.7);
      // Sized from the on-screen gap to the next strip, so neighbours can never collide.
      const next = project(frame, stripX(i) + 1.3, levelY(1) + 0.34, 0.2);
      const scale = Math.min(1.15, Math.abs(next.x - top.x) / 168);
      const pop = enter(frame, start, 8);
      return (
        <React.Fragment key={subject.name}>
          <div style={{ position: 'absolute', left: top.x, top: top.y, transform: `translate(-50%, -50%) scale(${scale * (0.8 + pop * 0.2)})`, opacity: pop, font: `750 66px/1 ${fontDisplay}`, color: C.text, textShadow: '0 2px 20px rgba(0,0,0,.9)', fontVariantNumeric: 'tabular-nums' }}>
            {subject.grade.toFixed(1)}
          </div>
          <div style={{ position: 'absolute', left: base.x, top: base.y, transform: `translate(-50%, -50%) scale(${scale})`, font: `700 40px/1 ${fontBody}`, color: C.text, textShadow: '0 2px 12px #000' }}>
            {subject.name}
          </div>
        </React.Fragment>
      );
    })}
  </>
);

/** One score stirs one meter, then the rest land on the eighth notes. */
export const Signal: React.FC = () => {
  const frame = useCurrentFrame();
  const quiz = rise(frame, CUE.signal, 20, 10);
  const quizOut = 1 - enter(frame, CUE.signalLands - 6, 8);
  const summaryAt = landingFrame(SUBJECTS.length - 1) + EIGHTH;
  const hero = enter(frame, summaryAt, 12);
  const line = project(frame, stripX(SUBJECTS.length - 1) + 0.9, levelY(TARGET_LEVEL), 0.2);
  return (
    <>
      <PinnedLabels frame={frame} />
      <SampleLabel />
      <div style={{ ...quiz, opacity: quiz.opacity * quizOut, position: 'absolute', top: 130, left: 720, whiteSpace: 'nowrap', padding: '20px 40px', borderRadius: 22, background: C.glassStrong, border: `3px solid ${C.signal}`, boxShadow: `0 0 50px ${C.signalGlow}`, font: `750 84px/1 ${fontDisplay}`, color: C.text }}>
        Math quiz&nbsp; <span style={{ color: C.signal }}>24 / 25</span>
      </div>
      <div style={{ ...rise(frame, CUE.signalLands, 20, 12), opacity: enter(frame, CUE.signalLands, 12) * (1 - hero), position: 'absolute', top: 48, left: 84, font: `750 70px/1 ${fontDisplay}`, letterSpacing: '-.02em', color: C.text, textShadow: '0 2px 24px #000' }}>
        Every quiz, task and exam.
      </div>
      <div style={{ position: 'absolute', top: 48, left: 84, opacity: hero, padding: '18px 32px', borderRadius: 22, background: C.glassStrong, border: `2px solid ${C.edgeStrong}` }}>
        <div style={{ font: `750 58px/1 ${fontDisplay}`, color: C.text }}>Term overview</div>
        <div style={{ marginTop: 12, font: `500 42px/1 ${fontBody}`, color: C.text2 }}>
          General average <strong style={{ font: `750 50px/1 ${fontDisplay}`, color: C.signal }}>{generalAverage().toFixed(1)}</strong>
          <span style={{ marginLeft: 26 }}>Target <strong style={{ font: `750 50px/1 ${fontDisplay}`, color: C.valve }}>{TARGET}</strong></span>
        </div>
      </div>
      {hero > 0 ? <div style={{ position: 'absolute', left: line.x + 12, top: line.y, transform: 'translateY(-50%)', opacity: hero, font: `750 40px/1 ${fontDisplay}`, color: C.valve, textShadow: '0 2px 12px #000' }}>{TARGET}</div> : null}
    </>
  );
};
