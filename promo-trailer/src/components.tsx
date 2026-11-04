import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, enter, fontBody, fontDisplay, needle } from './theme';
import { EXAM_MAX, EXAM_WEIGHT, SUBJECTS, TARGET, TASKS, WRITTEN, examAdds, examPercent, generalAverage, tasksAdds, termGrade, toLevel, writtenAdds } from './data';

export const Stage: React.FC<{ children: React.ReactNode; aura?: number }> = ({ children, aura = 1 }) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: fontBody, color: C.text2 }}>
    <AbsoluteFill
      style={{
        opacity: aura,
        background: `radial-gradient(920px 780px at 18% 8%, ${C.auraSignal}, transparent 70%), radial-gradient(1000px 850px at 86% 22%, ${C.auraGain}, transparent 72%), radial-gradient(770px 580px at 50% 100%, ${C.auraValve}, transparent 70%)`,
      }}
    />
    {children}
  </AbsoluteFill>
);

/** Shown whenever grades are on screen. */
export const SampleLabel: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div
    style={{
      position: 'absolute', top: 48, right: 72, zIndex: 20, opacity,
      padding: '12px 26px', borderRadius: 999, background: C.glassStrong, border: `2px solid ${C.borderStrong}`,
      font: `700 46px/1 ${fontBody}`, color: C.text,
    }}
  >
    Sample grades
  </div>
);

const tickMask = (pitch: number, gap: number, direction = 'to top') =>
  `repeating-linear-gradient(${direction}, #000 0 ${pitch}px, transparent ${pitch}px ${pitch + gap}px)`;

export const Meter: React.FC<{
  width: number; height: number; level: number; projected?: number; target?: number; targetGlow?: number;
  pitch?: number; gap?: number; glow?: number; radius?: number;
}> = ({ width, height, level, projected, target, targetGlow = 1, pitch = 8, gap = 4, glow = 1, radius = 12 }) => {
  const bottom = Math.max(0, level) * height;
  const top = projected === undefined ? bottom : Math.max(bottom, projected * height);
  return (
    <div style={{ position: 'relative', width, height }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, background: `repeating-linear-gradient(to top, ${C.track} 0 ${pitch}px, transparent ${pitch}px ${pitch + gap}px)` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, overflow: 'hidden', borderRadius: radius, WebkitMaskImage: tickMask(pitch, gap), maskImage: tickMask(pitch, gap) }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bottom, background: `linear-gradient(to top, ${C.signal}, ${C.signalStrong})`, boxShadow: `0 0 ${36 * glow}px ${C.signalGlow}` }} />
        {top > bottom ? <div style={{ position: 'absolute', left: 0, right: 0, bottom, height: top - bottom, background: `linear-gradient(to top, ${C.gain}, ${C.gainStrong})` }} /> : null}
      </div>
      {target !== undefined ? (
        <div style={{ position: 'absolute', left: -6, right: -6, bottom: target * height - 2, height: 4, opacity: targetGlow > 0 ? 1 : 0, background: C.valve, boxShadow: `0 0 ${18 * targetGlow}px ${C.valve}` }} />
      ) : null}
    </div>
  );
};

/** The landing page's mixing console: each subject is a channel strip, on a 60 to 100 scale. */
export const Console: React.FC<{
  frame: number; width?: number; meterHeight?: number; landing?: readonly number[]; stir?: number; ga?: number; targetOn?: number; dimmed?: number;
}> = ({ frame, width = 1560, meterHeight = 470, landing, stir = 0, ga = 1, targetOn = 1, dimmed = 0 }) => {
  const scale = width / 1560;
  return (
    <div
      style={{
        position: 'relative', width: 1560, transform: `scale(${scale})`, transformOrigin: 'top center', padding: '40px 52px 36px', borderRadius: 36, border: '2px solid transparent',
        background: `linear-gradient(${C.glass}, ${C.glass}) padding-box, ${C.gradEdge} border-box`,
        boxShadow: '0 40px 100px -30px rgba(0,0,0,.85), 0 -30px 120px -40px rgba(79,224,192,.45)',
        filter: dimmed ? `saturate(${1 - dimmed})` : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 34 }}>
        <div>
          <div style={{ font: `700 52px/1.1 ${fontDisplay}`, color: C.text }}>Term overview</div>
          <div style={{ marginTop: 10, font: `400 36px/1.2 ${fontBody}`, color: C.text2, opacity: ga }}>
            General average <strong style={{ font: `700 42px/1 ${fontDisplay}`, color: C.signal }}>{generalAverage().toFixed(1)}</strong>
            <span style={{ marginLeft: 28 }}>Target <strong style={{ font: `700 42px/1 ${fontDisplay}`, color: C.valve }}>{TARGET}</strong></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 34, font: `400 32px/1 ${fontBody}`, color: C.text3 }}>
          <LegendKey color={C.signal}>Recorded</LegendKey>
          <LegendKey color={C.gain}>Projected</LegendKey>
          <LegendKey color={C.valve} line>Target</LegendKey>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 20 }}>
        {SUBJECTS.map((subject, i) => {
          const start = landing?.[i];
          const landed = start === undefined ? 1 : needle(frame, start);
          const shown = start === undefined ? 1 : frame >= start ? 1 : 0;
          const pop = start === undefined ? 0 : 1 - enter(frame, start, 10);
          const stirring = i === 0 && start !== undefined && frame < start ? stir : 0;
          return (
            <div key={subject.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <span style={{ font: `700 50px/1 ${fontDisplay}`, color: C.text, opacity: shown, transform: `translateY(${pop * 12}px)`, fontVariantNumeric: 'tabular-nums' }}>{subject.grade.toFixed(1)}</span>
              <Meter width={118} height={meterHeight} level={toLevel(subject.grade) * landed + stirring * toLevel(subject.grade) * (1 - landed)} target={toLevel(TARGET)} targetGlow={targetOn} />
              <span style={{ font: `500 36px/1 ${fontBody}`, color: C.text2 }}>{subject.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LegendKey: React.FC<{ color: string; line?: boolean; children: React.ReactNode }> = ({ color, line, children }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <i style={{ display: 'block', width: 26, height: line ? 5 : 26, borderRadius: line ? 2 : 7, background: color }} />
    {children}
  </span>
);

export const Slider: React.FC<{ value: number; max?: number; width?: number; colour?: string }> = ({ value, max = EXAM_MAX, width = 900, colour = C.signal }) => {
  const x = (value / max) * width;
  return (
    <div style={{ position: 'relative', width, height: 44 }}>
      <div style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 12, borderRadius: 6, background: C.track }} />
      <div style={{ position: 'absolute', top: 16, left: 0, width: x, height: 12, borderRadius: 6, background: colour }} />
      <div style={{ position: 'absolute', top: 0, left: x - 22, width: 44, height: 44, borderRadius: 22, background: C.text, border: `5px solid ${colour}`, boxShadow: `0 0 26px ${colour}` }} />
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; colour?: string; size?: number }> = ({ children, colour = C.signal, size = 30 }) => (
  <span style={{ padding: '6px 14px', borderRadius: 10, border: `2px solid ${colour}`, color: colour, font: `700 ${size}px/1 ${fontBody}`, whiteSpace: 'nowrap' }}>{children}</span>
);

/** The worked grade: the same rows the landing page's ledger shows. */
export const Ledger: React.FC<{ score: number; size?: number; highlight?: number; showTotal?: boolean }> = ({ score, size = 42, highlight = 0, showTotal = true }) => {
  const cell: React.CSSProperties = { padding: `${size * 0.42}px 0`, borderTop: `2px solid ${C.border}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.text2, whiteSpace: 'nowrap' };
  const head: React.CSSProperties = { ...cell, borderTop: 0, padding: `0 0 ${size * 0.3}px`, font: `400 ${size * 0.76}px/1 ${fontBody}`, color: C.text3 };
  const row: React.CSSProperties = { ...cell, textAlign: 'left', color: C.text };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', font: `400 ${size}px/1.1 ${fontBody}` }}>
      <thead>
        <tr>
          <th style={{ ...head, textAlign: 'left', fontWeight: 400 }}>Component</th>
          <th style={{ ...head, fontWeight: 400 }}>Score</th>
          <th style={{ ...head, fontWeight: 400 }}>Weight</th>
          <th style={{ ...head, fontWeight: 400 }}>Adds</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style={row}>Written work</td><td style={cell}>{WRITTEN.percent}%</td><td style={cell}>{WRITTEN.weight}%</td><td style={cell}>{writtenAdds().toFixed(1)}</td></tr>
        <tr><td style={row}>Performance tasks</td><td style={cell}>{TASKS.percent}%</td><td style={cell}>{TASKS.weight}%</td><td style={cell}>{tasksAdds().toFixed(1)}</td></tr>
        <tr style={{ background: highlight ? `rgba(140, 124, 255, ${0.16 * highlight})` : undefined }}>
          <td style={row}>Exam, {score} / {EXAM_MAX}</td><td style={cell}>{examPercent(score).toFixed(0)}%</td><td style={cell}>{EXAM_WEIGHT}%</td><td style={cell}>{examAdds(score).toFixed(1)}</td>
        </tr>
      </tbody>
      {showTotal ? (
        <tfoot>
          <tr>
            <td colSpan={3} style={{ ...row, borderTop: `2px solid ${C.borderStrong}`, font: `700 ${size * 1.2}px/1.1 ${fontDisplay}` }}>Term grade</td>
            <td style={{ ...cell, borderTop: `2px solid ${C.borderStrong}`, color: C.text, font: `700 ${size * 1.2}px/1.1 ${fontDisplay}` }}>{termGrade(score).toFixed(1)}</td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
};

export const Panel: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ borderRadius: 26, padding: 44, background: C.glassStrong, border: `2px solid ${C.edgeStrong}`, boxShadow: '0 24px 56px -24px rgba(0,0,0,.8)', ...style }}>{children}</div>
);
