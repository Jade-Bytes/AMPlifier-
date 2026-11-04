import * as THREE from 'three';
import { BEAT, CUE, EIGHTH, WIDTH, HEIGHT, bar } from '../beats';
import { SUBJECTS, TARGET, termGrade, toLevel } from '../data';

/** The console's physical layout, shared by the 3D scene and the text pinned to it. */
export const STRIP_GAP = 1.3;
export const METER_BASE = 0.85;
export const METER_HEIGHT = 5.2;
export const stripX = (i: number) => (i - (SUBJECTS.length - 1) / 2) * STRIP_GAP;
export const levelY = (level: number) => METER_BASE + METER_HEIGHT * level;
export const TARGET_LEVEL = toLevel(TARGET);

export const landingFrame = (i: number) => CUE.signalLands + i * EIGHTH;
const MATH = 0;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Slider position in the Simulator. It moves one detent a beat and lands on the drop. */
export const examScore = (frame: number) =>
  frame >= CUE.drop ? 48 : frame >= CUE.approach + BEAT * 3 ? 47 : frame >= CUE.approach + BEAT * 2 ? 46 : 45;

export type StripState = { recorded: number; projected: number; target: number };

/** What each meter shows at a frame. Beats drive light, never level: a meter only ever shows its real grade. */
export const stripState = (frame: number, i: number): StripState => {
  const full = toLevel(SUBJECTS[i].grade);
  const start = landingFrame(i);
  let recorded = full;
  if (frame < CUE.signal) recorded = 0;
  else if (frame < start) recorded = i === MATH ? easeOut(clamp01((frame - CUE.signal) / (BEAT * 2))) * full * 0.7 : 0;
  else if (frame < start + 14) {
    const t = clamp01((frame - start) / 14);
    const from = i === MATH ? full * 0.7 : 0;
    const settle = t < 0.7 ? easeOut(t / 0.7) * 1.03 : 1.03 - ((t - 0.7) / 0.3) * 0.03;
    recorded = Math.min(1, from + (full - from) * settle);
  }
  let projected = recorded;
  if (i === MATH && frame >= CUE.approach && frame < CUE.everywhere) projected = toLevel(termGrade(examScore(frame)));

  // The target line appears after the last subject lands. On the drop it ignites outward from Math.
  let target = frame < CUE.signalSurge - EIGHTH ? 0 : 0.55;
  if (frame >= CUE.approach && frame < CUE.drop) target = i === MATH ? 0.5 : 0.12;
  if (frame >= CUE.drop && frame < CUE.everywhere) {
    const lit = frame - CUE.drop - i * 1.5;
    target = lit < 0 ? 0.12 : 1 + 2.5 * Math.exp(-lit / 10);
  }
  return { recorded, projected, target };
};

/** Global light level: quiet at first, dark in the break, driven by the music after the drop. */
export const stageAt = (frame: number) => {
  const sinceBeat = Math.max(0, frame - bar(0)) % BEAT;
  const beat = frame >= CUE.rise ? Math.exp(-sinceBeat / 7) : 0;
  let bright = 0.05 + 0.95 * clamp01((frame - CUE.signal) / 150);
  if (frame >= CUE.breakdown && frame < CUE.drop) bright = 0.14;
  if (frame >= CUE.close) bright = 0.3;
  const hit = (cue: number, length: number) => (frame >= cue ? Math.exp(-(frame - cue) / length) : 0);
  const impact = hit(CUE.drop, 10) + 0.4 * hit(CUE.sync, 10) + 0.5 * hit(CUE.finalNote, 16);
  return { bright, beat, impact };
};

/* ───────── Camera ───────── */

type V = [number, number, number];
type Shot = { from: number; to: number; a: V; b: V; lookA: V; lookB: V; fov?: number; fovB?: number; whip?: boolean };

/** Stations for the device sequence, far along the same stage. */
export const STATION = { android: 40, windows: 62, apple: 84, browser: 106, syncCentre: 73 };
const lookAhead = -3.9;
const station = (x: number, prev: number, from: number, to: number): Shot => ({
  from, to, whip: true,
  a: [prev + 1.5, 3.6, 18], b: [x + lookAhead + 0.6, 3.2, 16],
  lookA: [prev + lookAhead, 3, 0], lookB: [x + lookAhead, 3, 0], fov: 36,
});

const SHOTS: Shot[] = [
  { from: 0, to: CUE.signal, a: [0, 3.4, 12], b: [0, 3.1, 8.4], lookA: [0, 3.2, 0], lookB: [0, 3.1, 0], fov: 30 },
  // One meter stirs, close and low.
  { from: CUE.signal, to: CUE.signalLands, a: [-7.4, 1.5, 5.4], b: [-6.8, 1.9, 4.9], lookA: [-4.9, 3.2, 0], lookB: [-4.7, 3.4, 0], fov: 38 },
  // Sweep down the desk as the rest land.
  { from: CUE.signalLands, to: CUE.signalSurge - BEAT * 2, a: [-7, 3.6, 11.4], b: [3.8, 4, 11], lookA: [-2.6, 4.6, 0], lookB: [2.6, 4.6, 0], fov: 42 },
  // The whole console, rising.
  { from: CUE.signalSurge - BEAT * 2, to: CUE.rise, a: [2.2, 3.4, 15.4], b: [0, 4.2, 14.6], lookA: [0, 4.6, 0], lookB: [0, 4.7, 0], fov: 38 },
  { from: CUE.rise, to: CUE.forecast, a: [-12, 1.6, 9], b: [-10.2, 2.4, 9.6], lookA: [-1, 3, 0], lookB: [0, 3, 0], fov: 36 },
  { from: CUE.forecast, to: CUE.reportCard, a: [11, 8.6, 10], b: [8.4, 7.4, 11.4], lookA: [1, 2.6, 0], lookB: [0, 2.8, 0], fov: 36 },
  { from: CUE.reportCard, to: CUE.gradebook, a: [-5, 0.9, 8.4], b: [-1.4, 1.1, 8.4], lookA: [-2, 4.2, 0], lookB: [0, 4.2, 0], fov: 44 },
  { from: CUE.gradebook, to: CUE.planning, a: [-2, 13, 8], b: [1.4, 11.6, 9.4], lookA: [0, 2, 0], lookB: [0, 2, 0], fov: 36 },
  { from: CUE.planning, to: CUE.approach, a: [13, 2.6, 6.4], b: [10.4, 3.4, 8.8], lookA: [0, 3, 0], lookB: [0, 3.2, 0], fov: 36 },
  // Math on the right of frame, the worked grade on the left. Pushing in until the drop throws it back.
  { from: CUE.approach, to: CUE.drop, a: [-7.1, 3.5, 9], b: [-6.9, 3.65, 8.1], lookA: [-6.55, 3.5, 0], lookB: [-6.55, 3.6, 0], fov: 40 },
  { from: CUE.drop, to: CUE.everywhere, a: [-6.9, 3.7, 8], b: [-7.3, 3.65, 8.9], lookA: [-6.55, 3.6, 0], lookB: [-6.55, 3.55, 0], fov: 40 },
  station(STATION.android, STATION.android - 8, CUE.android, CUE.windows),
  station(STATION.windows, STATION.android, CUE.windows, CUE.apple),
  station(STATION.apple, STATION.windows, CUE.apple, CUE.browser),
  station(STATION.browser, STATION.apple, CUE.browser, CUE.sync),
  { from: CUE.sync, to: CUE.close, a: [STATION.syncCentre + 2, 3.2, 37], b: [STATION.syncCentre + 2, 3.4, 33.5], lookA: [STATION.syncCentre + 2, -2.9, 0], lookB: [STATION.syncCentre + 2, -2.9, 0], fov: 32 },
  { from: CUE.close, to: 1801, a: [0, 9.6, 24], b: [0, 7.4, 19], lookA: [0, 3.6, 0], lookB: [0, 3.2, 0], fov: 34 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: V, b: V, t: number): V => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Whip fast to the new station, then drift while the text is read. */
const whip = (t: number) => 1 - Math.pow(1 - clamp01(t * 2.4), 4);

export const cameraAt = (frame: number) => {
  const shot = SHOTS.find((s) => frame >= s.from && frame < s.to) ?? SHOTS[SHOTS.length - 1];
  const raw = clamp01((frame - shot.from) / (shot.to - shot.from));
  const t = shot.whip ? whip(raw) * 0.93 + raw * 0.07 : smooth(raw) * 0.35 + raw * 0.65;
  const pos = lerpV(shot.a, shot.b, t);
  const look = lerpV(shot.lookA, shot.lookB, t);
  // The drop kicks the camera, then it settles. Deterministic, so every render matches.
  const since = frame - CUE.drop;
  if (since >= 0 && since < 26) {
    const k = Math.exp(-since / 6) * 0.16;
    pos[0] += Math.sin(since * 2.3) * k;
    pos[1] += Math.cos(since * 3.1) * k;
    pos[2] += 0.8 * Math.exp(-since / 5);
  }
  return { pos, look, fov: shot.fov ?? 38 };
};

const probe = new THREE.PerspectiveCamera(38, WIDTH / HEIGHT, 0.1, 400);
const point = new THREE.Vector3();

/** Where a 3D point lands on screen, so text stays sharp and pinned to the object it labels. */
export const project = (frame: number, x: number, y: number, z: number) => {
  const c = cameraAt(frame);
  probe.fov = c.fov;
  probe.position.set(...c.pos);
  probe.lookAt(...c.look);
  probe.updateProjectionMatrix();
  probe.updateMatrixWorld(true);
  const distance = probe.position.distanceTo(point.set(x, y, z));
  point.project(probe);
  return { x: ((point.x + 1) / 2) * WIDTH, y: ((1 - point.y) / 2) * HEIGHT, distance, visible: point.z < 1 };
};
