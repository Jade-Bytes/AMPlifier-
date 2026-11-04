/**
 * Every cut in the trailer comes from these constants, so edits stay on the music.
 *
 * The generated track measures 75 BPM (a 150 BPM eighth-note drive at half-time), which at 30 fps is
 * exactly 24 frames a beat and 96 frames a bar. The grid starts at frame 36 (1.2 s).
 */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BPM = 75;
export const BEAT = 24;
export const EIGHTH = 12;
export const BAR = 96;
export const GRID_START = 36;
export const DURATION = 1800;

/** Frame of a bar line, counted from the first bar of the grid. */
export const bar = (n: number, beats = 0) => GRID_START + n * BAR + beats * BEAT;

export const CUE = {
  tensionLine: bar(0),
  tensionQuestion: bar(1),
  signal: bar(2),
  signalLands: bar(2, 2),
  signalSurge: bar(4),
  rise: bar(4),
  forecast: bar(4, 3),
  reportCard: bar(5, 2),
  gradebook: bar(6, 1),
  planning: bar(7),
  approach: bar(8),
  breakdown: bar(8, 3),
  drop: bar(9),
  everywhere: bar(11),
  android: bar(11),
  windows: bar(12),
  apple: bar(13),
  browser: bar(14),
  secondBreak: bar(14, 2.5),
  sync: bar(15),
  close: bar(16),
  finalNote: bar(17),
  ringEnds: bar(18),
} as const;

export const seconds = (frame: number) => frame / FPS;

/** The source track's own bar grid, measured from its onsets. */
export const SOURCE_BAR_SECONDS = 3.2;
export const SOURCE_GRID_OFFSET = 0.02;
const sourceBar = (n: number) => SOURCE_GRID_OFFSET + n * SOURCE_BAR_SECONDS;

/**
 * Bars of the source kept, and where each block starts in the trailer. Removing bars 9-10 and bar 17
 * lands the hit after the first silent break (source bar 8) exactly on the drop.
 */
export const MUSIC_BLOCKS = [
  { from: sourceBar(0), to: sourceBar(9), at: seconds(bar(1)) },
  { from: sourceBar(11), to: sourceBar(17), at: seconds(bar(10)) },
  { from: sourceBar(18), to: sourceBar(20) + 0.5, at: seconds(bar(16)) },
];

export const check = () => {
  const dropInSource = sourceBar(8);
  const dropInTrailer = MUSIC_BLOCKS[0].at + (dropInSource - MUSIC_BLOCKS[0].from);
  if (Math.abs(dropInTrailer - seconds(CUE.drop)) > 0.001) throw new Error(`Drop misaligned: ${dropInTrailer}`);
  if (CUE.drop !== 900) throw new Error('The drop must land at 30.0 s');
  if (CUE.ringEnds > DURATION) throw new Error('The final chord must ring out before the end');
};
