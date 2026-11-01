/**
 * Standard Department of Education (DepEd Order No. 8, s. 2015)
 * Transmutation Table for K to 12 Basic Education Program.
 */

export interface TransmutationEntry {
  min: number;
  max: number;
  transmuted: number;
}

export const DEPED_TRANSMUTATION_TABLE: TransmutationEntry[] = [
  { min: 100.00, max: 100.00, transmuted: 100 },
  { min: 98.40, max: 99.9999, transmuted: 99 },
  { min: 96.80, max: 98.3999, transmuted: 98 },
  { min: 95.20, max: 96.7999, transmuted: 97 },
  { min: 93.60, max: 95.1999, transmuted: 96 },
  { min: 92.00, max: 93.5999, transmuted: 95 },
  { min: 90.40, max: 91.9999, transmuted: 94 },
  { min: 88.80, max: 90.3999, transmuted: 93 },
  { min: 87.20, max: 88.7999, transmuted: 92 },
  { min: 85.60, max: 87.1999, transmuted: 91 },
  { min: 84.00, max: 85.5999, transmuted: 90 },
  { min: 82.40, max: 83.9999, transmuted: 89 },
  { min: 80.80, max: 82.3999, transmuted: 88 },
  { min: 79.20, max: 80.7999, transmuted: 87 },
  { min: 77.60, max: 79.1999, transmuted: 86 },
  { min: 76.00, max: 77.5999, transmuted: 85 },
  { min: 74.40, max: 75.9999, transmuted: 84 },
  { min: 72.80, max: 74.3999, transmuted: 83 },
  { min: 71.20, max: 72.7999, transmuted: 82 },
  { min: 69.60, max: 71.1999, transmuted: 81 },
  { min: 68.00, max: 69.5999, transmuted: 80 },
  { min: 66.40, max: 67.9999, transmuted: 79 },
  { min: 64.80, max: 66.3999, transmuted: 78 },
  { min: 63.20, max: 64.7999, transmuted: 77 },
  { min: 61.60, max: 63.1999, transmuted: 76 },
  { min: 60.00, max: 61.5999, transmuted: 75 },
  { min: 56.00, max: 59.9999, transmuted: 74 },
  { min: 52.00, max: 55.9999, transmuted: 73 },
  { min: 48.00, max: 51.9999, transmuted: 72 },
  { min: 44.00, max: 47.9999, transmuted: 71 },
  { min: 40.00, max: 43.9999, transmuted: 70 },
  { min: 36.00, max: 39.9999, transmuted: 69 },
  { min: 32.00, max: 35.9999, transmuted: 68 },
  { min: 28.00, max: 31.9999, transmuted: 67 },
  { min: 24.00, max: 27.9999, transmuted: 66 },
  { min: 20.00, max: 23.9999, transmuted: 65 },
  { min: 16.00, max: 19.9999, transmuted: 64 },
  { min: 12.00, max: 15.9999, transmuted: 63 },
  { min: 8.00, max: 11.9999, transmuted: 62 },
  { min: 4.00, max: 7.9999, transmuted: 61 },
  { min: 0.00, max: 3.9999, transmuted: 60 },
];

/**
 * Transmutes a raw initial score (0 - 100) into a DepEd official transmuted grade (60 - 100).
 */
export function transmuteGrade(initialGrade: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(initialGrade * 100) / 100));
  
  for (const entry of DEPED_TRANSMUTATION_TABLE) {
    if (clamped >= entry.min && clamped <= entry.max) {
      return entry.transmuted;
    }
  }

  if (clamped >= 100) return 100;
  return 60;
}

/**
 * Calculates the minimum initial grade (0 - 100) required to achieve a specific target transmuted grade.
 */
export function getMinimumInitialGradeForTransmuted(targetTransmuted: number): number {
  if (targetTransmuted >= 100) return 100.0;
  if (targetTransmuted <= 60) return 0.0;

  const targetRounded = Math.round(targetTransmuted);
  const entry = DEPED_TRANSMUTATION_TABLE.find(e => e.transmuted === targetRounded);
  if (entry) {
    return entry.min;
  }
  return 60.0;
}
