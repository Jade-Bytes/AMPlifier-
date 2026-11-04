import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { BEAT, CUE } from '../beats';
import { Ledger, SampleLabel, Slider } from '../components';
import { EXAM_MAX, TARGET, termGrade } from '../data';
import { C, enter, fontBody, fontDisplay, rise } from '../theme';
import { TARGET_LEVEL, examScore, levelY, project, stageAt, stripX } from '../world/layout';

/**
 * The approach and the drop, on one continuous shot. The physical Math meter fills the right of frame,
 * and the slider moves one detent a beat, hangs in the silent break, and lands on the drop.
 */
export const Moment: React.FC = () => {
  const frame = useCurrentFrame();
  const { approach, breakdown, drop } = CUE;
  const dropped = frame >= drop;
  const score = examScore(frame);
  const grade = termGrade(score);
  const projecting = score > 45;
  const colour = projecting ? C.gain : C.signal;
  const inBreak = frame >= breakdown && frame < drop;
  const { impact, beat } = stageAt(frame);
  const panelIn = enter(frame, approach, 13);
  const yaw = 9 + (1 - panelIn) * 40 + (dropped ? Math.exp(-(frame - drop) / 8) * -7 : 0);
  const glow = dropped ? 18 + beat * 22 + impact * 70 : 0;
  const label = project(frame, stripX(0) + 0.72, levelY(TARGET_LEVEL), 0.3);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(5,8,26,.88) 0%, rgba(5,8,26,.62) 52%, rgba(5,8,26,0) 68%)' }} />
      <SampleLabel />
      <div style={{ position: 'absolute', left: 60, top: 40, width: 1090, perspective: 2000, opacity: inBreak ? 0.6 : panelIn }}>
        <div style={{ transformOrigin: 'left center', transform: `rotateY(${yaw}deg)`, padding: '26px 34px', borderRadius: 30, background: C.glassStrong, border: `2px solid ${dropped ? C.valve : C.edgeStrong}`, boxShadow: dropped ? `0 0 ${glow}px ${C.valve}` : '0 40px 60px rgba(0,0,0,.6)' }}>
          <div style={{ ...rise(frame, approach, 18, 10), font: `800 68px/1.05 ${fontDisplay}`, letterSpacing: '-.025em', color: C.text }}>Math, in the Simulator</div>
          <div style={{ marginTop: 22 }}><Ledger score={score} size={43} highlight={projecting ? 1 : 0} showTotal={false} /></div>
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: `500 42px/1 ${fontBody}`, color: C.text2, marginBottom: 16 }}>
              <span>Quarterly exam</span>
              <strong style={{ font: `800 62px/1 ${fontDisplay}`, color: projecting ? C.gainStrong : C.text }}>{score} / {EXAM_MAX}</strong>
            </div>
            <Slider value={score} width={1018} colour={colour} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 28 }}>
            <span style={{ font: `800 186px/.95 ${fontDisplay}`, letterSpacing: '-.035em', color: colour, textShadow: dropped ? `0 0 ${50 + impact * 110}px ${C.gainGlow}` : undefined, transform: `scale(${1 + impact * 0.1})`, transformOrigin: 'left bottom' }}>{grade.toFixed(1)}</span>
            <span style={{ font: `700 46px/1 ${fontBody}`, color: C.text2 }}>Term grade</span>
          </div>
          <div style={{ ...rise(frame, drop + BEAT, 18, 12), marginTop: 8, font: `800 62px/1.1 ${fontDisplay}`, letterSpacing: '-.02em', color: C.valve }}>
            You need 48 / 50 to reach {TARGET}.
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: label.x + 4, top: label.y, transform: 'translateY(-115%)', padding: '6px 14px', borderRadius: 12, background: 'rgba(5,8,26,.84)', opacity: inBreak ? 0.65 : 1, font: `800 ${dropped ? 62 : 48}px/1 ${fontDisplay}`, color: C.valve, whiteSpace: 'nowrap', textShadow: dropped ? `0 0 ${glow}px ${C.valve}` : undefined }}>
        Target {TARGET}
      </div>
      <div style={{ ...rise(frame, drop + BEAT * 2, 12, 12), position: 'absolute', left: 84, bottom: 18, padding: '6px 12px', borderRadius: 10, background: 'rgba(5,8,26,.72)', font: `500 40px/1.1 ${fontBody}`, color: C.text }}>
        Nothing is saved. Grades are estimates from the scores you enter.
      </div>
      <AbsoluteFill style={{ background: C.gainStrong, opacity: dropped ? Math.exp(-(frame - drop) / 4) * 0.5 : 0, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
