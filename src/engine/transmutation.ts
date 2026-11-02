/**
 * DepEd Order No. 8, s. 2015 transmutation table (K to 12 Basic Education Program).
 * Each row is the lowest initial grade that earns the transmuted grade.
 * Rows are ordered from highest to lowest so the first match wins.
 */
const DEPED_THRESHOLDS: ReadonlyArray<readonly [minInitial: number, transmuted: number]> = [
  [100, 100], [98.4, 99], [96.8, 98], [95.2, 97], [93.6, 96], [92, 95], [90.4, 94], [88.8, 93],
  [87.2, 92], [85.6, 91], [84, 90], [82.4, 89], [80.8, 88], [79.2, 87], [77.6, 86], [76, 85],
  [74.4, 84], [72.8, 83], [71.2, 82], [69.6, 81], [68, 80], [66.4, 79], [64.8, 78], [63.2, 77],
  [61.6, 76], [60, 75], [56, 74], [52, 73], [48, 72], [44, 71], [40, 70], [36, 69], [32, 68],
  [28, 67], [24, 66], [20, 65], [16, 64], [12, 63], [8, 62], [4, 61], [0, 60],
];

/** Transmutes a 0–100 initial grade into the DepEd 60–100 reporting scale. */
export function transmuteDepEd(initialGrade: number): number {
  if (!Number.isFinite(initialGrade)) return 60;
  // Round to 4 decimals first so floating-point noise (e.g. 75.99999999) cannot drop a band.
  const value = Math.max(0, Math.min(100, Math.round(initialGrade * 10_000) / 10_000));
  for (const [min, transmuted] of DEPED_THRESHOLDS) {
    if (value >= min) return transmuted;
  }
  return 60;
}

/** Lowest initial grade that transmutes to at least `target` (null when the target exceeds 100). */
export function minimumInitialGradeFor(target: number): number | null {
  if (target > 100) return null;
  if (target <= 60) return 0;
  const row = [...DEPED_THRESHOLDS].reverse().find(([, transmuted]) => transmuted >= Math.ceil(target));
  return row ? row[0] : null;
}
