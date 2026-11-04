import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Badge, Ledger, Panel, SampleLabel, Slider } from '../components';
import { SUBJECTS, TARGET, generalAverage, termGrade } from '../data';
import { C, enter, fontBody, fontDisplay, rise } from '../theme';

/** Each panel swings in on its own axis and floats in front of the console. */
const Frame: React.FC<{ title: string; line: string; grades?: boolean; titleSize?: number; swing?: number; children: React.ReactNode }> = ({ title, line, grades, titleSize = 112, swing = -1, children }) => {
  const frame = useCurrentFrame();
  const inP = enter(frame, 0, 13);
  const yaw = swing * (11 + (1 - inP) * 62) + Math.sin(frame * 0.035) * 1.6;
  const pitch = 3 + (1 - inP) * -12 + Math.cos(frame * 0.03) * 0.8;
  const depth = (1 - inP) * -520 + frame * 0.7;
  return (
    <AbsoluteFill>
      {/* Keeps the text clear of whatever the camera is passing. */}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(5,8,26,.92) 0%, rgba(5,8,26,.72) 34%, rgba(5,8,26,.22) 62%, rgba(5,8,26,.34) 100%)' }} />
      {grades ? <SampleLabel /> : null}
      <div style={{ position: 'absolute', left: 84, top: 214, width: 620 }}>
        <div style={{ ...rise(frame, 0, 44, 11), font: `800 ${titleSize}px/1 ${fontDisplay}`, letterSpacing: '-.035em', color: C.text, textShadow: `0 0 44px ${C.gainGlow}` }}>{title}</div>
        <div style={{ ...rise(frame, 4, 22, 10), marginTop: 28, font: `500 50px/1.22 ${fontBody}`, color: C.text }}>{line}</div>
      </div>
      <div style={{ position: 'absolute', left: 736, right: 70, top: 130, bottom: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center', perspective: 1700, opacity: inP }}>
        <div style={{ transformStyle: 'preserve-3d', transform: `translateZ(${depth}px) rotateY(${yaw}deg) rotateX(${pitch}deg)`, filter: 'drop-shadow(0 50px 60px rgba(0,0,0,.75))' }}>
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SimulatorPanel: React.FC = () => (
  <Frame title="Simulator" line="Try a score before you earn it." grades>
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: `500 46px/1 ${fontBody}`, color: C.text2 }}>
        <span>Math, quarterly exam</span>
        <strong style={{ color: C.text }}>45 / 50</strong>
      </div>
      <div style={{ margin: '42px 0 46px' }}><Slider value={45} width={1012} /></div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 30 }}>
        <span style={{ font: `750 200px/1 ${fontDisplay}`, letterSpacing: '-.03em', color: C.signal }}>{termGrade(45).toFixed(1)}</span>
        <Badge>Estimated</Badge>
      </div>
      <div style={{ marginTop: 22, font: `400 38px/1.2 ${fontBody}`, color: C.text3 }}>Nothing is saved until you record it.</div>
    </Panel>
  </Frame>
);

export const ForecastPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = enter(frame, 2, 44);
  return (
    <Frame title="Forecast" line="Set a goal, then compare cautious, realistic and hopeful terms." grades swing={1}>
      <Panel>
        <div style={{ font: `700 46px/1 ${fontDisplay}`, color: C.text }}>Final-average goal <span style={{ color: C.valve }}>{TARGET}</span></div>
        <svg viewBox="0 0 1010 380" style={{ display: 'block', width: '100%', marginTop: 34, overflow: 'visible' }}>
          <line x1="0" x2="1010" y1="80" y2="80" stroke={C.valve} strokeWidth="5" strokeDasharray="16 14" />
          <text x="1010" y="56" textAnchor="end" fill={C.valve} style={{ font: `700 38px ${fontBody}` }}>Target</text>
          <g style={{ clipPath: `inset(-20px ${(1 - draw) * 100}% -20px 0)` }}>
            <polyline points="20,300 240,220 480,150" fill="none" stroke={C.signal} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="480,150 730,104 990,84" fill="none" stroke={C.gain} strokeWidth="10" strokeLinecap="round" strokeDasharray="4 22" />
            <circle cx="480" cy="150" r="15" fill={C.bg} stroke={C.signal} strokeWidth="7" />
          </g>
          <text x="20" y="372" fill={C.signal} style={{ font: `700 38px ${fontBody}` }}>Recorded</text>
          <text x="990" y="372" textAnchor="end" fill={C.gain} style={{ font: `700 38px ${fontBody}` }}>Projected</text>
        </svg>
        <div style={{ display: 'flex', gap: 18, marginTop: 34 }}>
          {['Cautious', 'Realistic', 'Hopeful'].map((name, i) => (
            <div key={name} style={{ ...rise(frame, 18 + i * 8, 14, 10), flex: 1, padding: '20px 0', textAlign: 'center', borderRadius: 16, background: C.gainSoft, border: `2px solid ${C.gain}`, font: `700 40px/1 ${fontBody}`, color: C.text }}>{name}</div>
          ))}
        </div>
      </Panel>
    </Frame>
  );
};

export const ReportPanel: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Frame title="Report card" line="Every term labeled actual, estimated or projected." grades>
      <Panel style={{ padding: '36px 44px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ font: `700 46px/1 ${fontDisplay}`, color: C.text }}>This term</span>
          <span style={{ font: `400 36px/1 ${fontBody}`, color: C.text3 }}>Unofficial</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 52 }}>
          {SUBJECTS.map((subject, i) => (
            <div key={subject.name} style={{ ...rise(frame, 4 + i * 3, 12, 8), display: 'flex', alignItems: 'center', padding: '19px 0', borderTop: `2px solid ${C.border}`, font: `500 42px/1 ${fontBody}`, color: C.text }}>
              <span style={{ flex: 1 }}>{subject.name}</span>
              <strong style={{ font: `700 46px/1 ${fontDisplay}`, marginRight: 18 }}>{subject.grade.toFixed(1)}</strong>
              <Badge size={26}>Est.</Badge>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 22, borderTop: `2px solid ${C.borderStrong}`, font: `700 52px/1 ${fontDisplay}`, color: C.text }}>
          <span>General average</span>
          <span style={{ color: C.signal }}>{generalAverage().toFixed(1)}</span>
        </div>
      </Panel>
    </Frame>
  );
};

export const GradebookPanel: React.FC = () => (
  <Frame title="Gradebook" line="Scores grouped by written work, tasks and exams." grades swing={1}>
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 34 }}>
        <span style={{ font: `700 54px/1 ${fontDisplay}`, color: C.text }}>Math</span>
        <Badge>Estimated</Badge>
      </div>
      <Ledger score={45} size={44} />
    </Panel>
  </Frame>
);

export const PlanningPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const row = (title: string, meta: string, due: string) => (
    <div key={title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: `2px solid ${C.border}` }}>
      <div>
        <div style={{ font: `700 33px/1.15 ${fontBody}`, color: C.text }}>{title}</div>
        <div style={{ font: `400 28px/1.2 ${fontBody}`, color: C.text3 }}>{meta}</div>
      </div>
      <span style={{ font: `700 28px/1 ${fontBody}`, color: C.text2, whiteSpace: 'nowrap', marginLeft: 16 }}>{due}</span>
    </div>
  );
  return (
    <Frame title="Tasks, schedule and notes" line="Deadlines, your timetable and class notes, all together." titleSize={96}>
      {/* A real capture of the app's demo workspace. It shows no grades. */}
      <div style={{ ...rise(frame, 2, 18, 10), borderRadius: 22, overflow: 'hidden', border: `2px solid ${C.edgeStrong}` }}>
        <Img src={staticFile('app/schedule.png')} style={{ display: 'block', width: '100%' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 20, marginTop: 20 }}>
        <Panel style={{ ...rise(frame, 8, 18, 10), padding: '28px 32px' }}>
          <div style={{ font: `700 42px/1 ${fontDisplay}`, color: C.text, marginBottom: 18 }}>Tasks</div>
          {row('Geometry problem set', 'Mathematics, homework', 'Tomorrow')}
          {row('Ecosystem model', 'Science, project', 'In 4 days')}
          {row('Reading journal', 'English, assignment', 'Next week')}
        </Panel>
        <Panel style={{ ...rise(frame, 14, 18, 10), padding: '28px 32px' }}>
          <div style={{ font: `700 42px/1 ${fontDisplay}`, color: C.text, marginBottom: 18 }}>Notes</div>
          <div style={{ padding: '14px 0', borderTop: `2px solid ${C.border}`, font: `700 33px/1.15 ${fontBody}`, color: C.text }}>Class notes</div>
          <div style={{ font: `400 30px/1.3 ${fontBody}`, color: C.text3 }}>With attachments from Google Drive</div>
        </Panel>
      </div>
    </Frame>
  );
};
