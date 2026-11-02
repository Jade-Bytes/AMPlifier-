/**
 * Pure timing and pitch plans for sounds that follow animations. Kept free of Web Audio so the
 * rules can be unit-tested.
 */

/** Pentatonic steps (semitones) a counting run climbs or descends through: rises sound musical, never random. */
const STEPS = [0, 2, 4, 7, 9, 12];
const BASE_RATE = .62; // the tick asset is bright; counting sits lower, around 1.5 kHz
const MIN_GAP_MS = 42;

export type Tick = { at: number; rate: number; gain: number };

/**
 * Ticks for a number easing from `from` to `to` over `durationMs` (AnimatedNumber's ease-out). Ticks
 * span the first ~72% of the animation — while the digits are visibly changing — with gaps that widen
 * as the digits slow, so the rhythm decelerates with the number. Bigger changes get more ticks (3–9).
 */
export function countTicks(from: number, to: number, durationMs: number): Tick[] {
  const delta = Math.abs(to - from);
  if (!Number.isFinite(delta) || delta === 0 || durationMs <= 0) return [];
  const n = Math.max(3, Math.min(9, Math.round(2 + Math.log2(1 + delta) * 1.6)));
  const rising = to > from;
  const ticks: Tick[] = [];
  for (let k = 1; k <= n; k++) {
    const at = .72 * durationMs * (k / n) ** 1.35;
    if (ticks.length && at - ticks[ticks.length - 1].at < MIN_GAP_MS) continue;
    const position = (k - 1) / Math.max(1, n - 1);
    const step = STEPS[Math.round((rising ? position : 1 - position) * (STEPS.length - 1))];
    ticks.push({ at: Math.round(at), rate: BASE_RATE * 2 ** (step / 12), gain: rising ? .75 + .25 * position : 1 - .3 * position });
  }
  return ticks;
}

/** Which way a value moved across a threshold, if it crossed one. */
export function crossing(previous: number | null, next: number | null, threshold: number | null): 'up' | 'down' | null {
  if (previous === null || next === null || threshold === null) return null;
  if (previous < threshold && next >= threshold) return 'up';
  if (previous >= threshold && next < threshold) return 'down';
  return null;
}
