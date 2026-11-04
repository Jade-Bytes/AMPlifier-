import { loadFont as loadDisplay } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadBody } from '@remotion/google-fonts/AtkinsonHyperlegibleNext';
import { Easing, interpolate } from 'remotion';

export const fontDisplay = loadDisplay('normal', { weights: ['400', '600', '700', '800'], subsets: ['latin'] }).fontFamily;
export const fontBody = loadBody('normal', { weights: ['400', '500', '700'], subsets: ['latin'] }).fontFamily;

/** Dark-theme values from src/styles/tokens.css. Teal = recorded, violet = projected, amber = target. */
export const C = {
  bg: '#080c1b',
  bgDeep: '#05081a',
  auraSignal: 'rgba(64, 214, 182, .17)',
  auraGain: 'rgba(132, 112, 255, .22)',
  auraValve: 'rgba(247, 176, 76, .08)',
  glass: 'rgba(19, 25, 54, .72)',
  glassStrong: 'rgba(17, 23, 50, .94)',
  glassSubtle: 'rgba(255, 255, 255, .035)',
  edge: 'rgba(255, 255, 255, .085)',
  edgeStrong: 'rgba(255, 255, 255, .15)',
  track: 'rgba(255, 255, 255, .07)',
  border: 'rgba(255, 255, 255, .08)',
  borderStrong: 'rgba(255, 255, 255, .16)',
  text: '#eef1fb',
  text2: '#c4cae2',
  text3: '#9299bb',
  faint: '#6d769c',
  signal: '#4fe0c0',
  signalStrong: '#7cf0d6',
  signalSoft: 'rgba(79, 224, 192, .12)',
  signalGlow: 'rgba(79, 224, 192, .45)',
  gain: '#a498ff',
  gainStrong: '#c1b8ff',
  gainSoft: 'rgba(140, 124, 255, .15)',
  gainGlow: 'rgba(140, 124, 255, .5)',
  valve: '#f7b955',
  valveSoft: 'rgba(247, 185, 85, .13)',
  gradSignal: 'linear-gradient(120deg, #4fe0c0 0%, #6fb6ff 52%, #a08cff 100%)',
  gradEdge: 'linear-gradient(140deg, rgba(79, 224, 192, .55), rgba(140, 124, 255, .35) 45%, rgba(255, 255, 255, .06) 75%)',
};

const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0 to 1 over `duration` frames from `start`, using the app's --ease-out curve. */
export const enter = (frame: number, start: number, duration = 14) =>
  interpolate(frame, [start, start + duration], [0, 1], { ...clamp, easing: easeOut });

/** Needle-like settle: overshoots a little, as the landing page's meters do. */
export const needle = (frame: number, start: number, duration = 16) => {
  const t = interpolate(frame, [start, start + duration], [0, 1], clamp);
  return t < 0.72 ? easeOut(t / 0.72) * 1.045 : interpolate(t, [0.72, 1], [1.045, 1], clamp);
};

export const rise = (frame: number, start: number, distance = 28, duration = 14) => {
  const p = enter(frame, start, duration);
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
};
