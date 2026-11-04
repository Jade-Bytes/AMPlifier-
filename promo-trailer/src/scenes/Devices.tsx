import React from 'react';
import { C, fontBody, fontDisplay } from '../theme';
import { Meter } from '../components';
import { SUBJECTS, TARGET, generalAverage, toLevel } from '../data';

/** The same workspace on every device, wide or tall. Simple original frames, no real product imagery. */
export const Workspace: React.FC<{ layout: 'wide' | 'tall' }> = ({ layout }) => {
  if (layout === 'tall') {
    return (
      <div style={{ width: 420, height: 800, padding: '34px 26px', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: fontBody }}>
        <div style={{ font: `700 38px/1 ${fontDisplay}`, color: C.text }}>Term overview</div>
        <div style={{ margin: '12px 0 20px', font: `400 26px/1 ${fontBody}`, color: C.text2 }}>
          Average <strong style={{ color: C.signal }}>{generalAverage().toFixed(1)}</strong> &nbsp;Target <strong style={{ color: C.valve }}>{TARGET}</strong>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {SUBJECTS.map((subject) => (
            <div key={subject.name} style={{ display: 'grid', gridTemplateColumns: '112px 1fr 72px', alignItems: 'center', gap: 10, font: `500 26px/1 ${fontBody}`, color: C.text2 }}>
              <span>{subject.name}</span>
              <span style={{ position: 'relative', height: 26, borderRadius: 5, background: C.track }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${toLevel(subject.grade) * 100}%`, borderRadius: 5, background: C.signal }} />
                <span style={{ position: 'absolute', left: `${toLevel(TARGET) * 100}%`, top: -4, bottom: -4, width: 4, background: C.valve }} />
              </span>
              <strong style={{ font: `700 28px/1 ${fontDisplay}`, color: C.text, textAlign: 'right' }}>{subject.grade.toFixed(1)}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: 1000, height: 600, padding: '30px 36px', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: fontBody }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <span style={{ font: `700 44px/1 ${fontDisplay}`, color: C.text }}>Term overview</span>
        <span style={{ font: `400 30px/1 ${fontBody}`, color: C.text2 }}>
          General average <strong style={{ color: C.signal }}>{generalAverage().toFixed(1)}</strong> &nbsp;Target <strong style={{ color: C.valve }}>{TARGET}</strong>
        </span>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 14 }}>
        {SUBJECTS.map((subject) => (
          <div key={subject.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span style={{ font: `700 32px/1 ${fontDisplay}`, color: C.text }}>{subject.grade.toFixed(1)}</span>
            <Meter width={72} height={392} level={toLevel(subject.grade)} target={toLevel(TARGET)} pitch={7} gap={3} radius={8} />
            <span style={{ font: `500 25px/1 ${fontBody}`, color: C.text2 }}>{subject.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Screen: React.FC<{ width: number; height: number; contentWidth: number; contentHeight: number; layout: 'wide' | 'tall'; radius: number; top?: number; children?: React.ReactNode }> = ({ width, height, contentWidth, contentHeight, layout, radius, top = 0, children }) => {
  // Fit, never crop: the same workspace stays whole on every screen.
  const scale = Math.min(width / contentWidth, (height - top) / contentHeight);
  const left = (width - contentWidth * scale) / 2;
  const offset = top + (height - top - contentHeight * scale) / 2;
  return (
    <div style={{ position: 'relative', width, height, borderRadius: radius, overflow: 'hidden', background: C.bg }}>
      {children}
      <div style={{ position: 'absolute', top: offset, left, width: contentWidth, height: contentHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <Workspace layout={layout} />
      </div>
    </div>
  );
};

const shell = (radius: number, pad: number): React.CSSProperties => ({
  padding: pad, borderRadius: radius, background: 'linear-gradient(160deg, #2a3158, #141a38)', border: `2px solid ${C.edgeStrong}`, boxShadow: '0 40px 90px -30px rgba(0,0,0,.9)',
});

export const Phone: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div style={{ ...shell(54 * scale, 14 * scale), display: 'inline-block' }}>
    <Screen width={320 * scale} height={640 * scale} contentWidth={420} contentHeight={800} layout="tall" radius={42 * scale} />
  </div>
);

export const Tablet: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div style={{ ...shell(36 * scale, 20 * scale), display: 'inline-block' }}>
    <Screen width={760 * scale} height={480 * scale} contentWidth={1000} contentHeight={600} layout="wide" radius={18 * scale} />
  </div>
);

export const Laptop: React.FC<{ scale?: number; bar?: React.ReactNode; barHeight?: number; bottomBar?: boolean }> = ({ scale = 1, bar, barHeight = 0, bottomBar }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ ...shell(24 * scale, 16 * scale), borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
      <Screen width={960 * scale} height={600 * scale} contentWidth={1000} contentHeight={600} layout="wide" radius={10 * scale} top={barHeight * scale}>
        {bar}
      </Screen>
      {bottomBar ? <div style={{ height: 30 * scale, background: '#161c3b', borderTop: `2px solid ${C.edge}` }} /> : null}
    </div>
    <div style={{ width: 1130 * scale, height: 28 * scale, borderRadius: `0 0 ${24 * scale}px ${24 * scale}px`, background: 'linear-gradient(180deg, #363e6b, #1a2044)' }} />
  </div>
);

export const AddressBar: React.FC<{ text: string; scale?: number }> = ({ text, scale = 1 }) => (
  <div style={{ position: 'absolute', zIndex: 2, top: 0, left: 0, right: 0, height: 70 * scale, display: 'flex', alignItems: 'center', gap: 14 * scale, padding: `0 ${22 * scale}px`, background: '#161c3b', borderBottom: `2px solid ${C.edge}` }}>
    <div style={{ flex: 1, padding: `${11 * scale}px ${22 * scale}px`, borderRadius: 999, background: C.bgDeep, font: `500 ${30 * scale}px/1 ${fontBody}`, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden' }}>{text}</div>
  </div>
);
