/**
 * Shared chart styling so every Recharts chart reads as one system. Colours are CSS custom
 * properties from tokens.css, so charts follow the active theme without re-rendering logic.
 */
export const chart = {
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  cursor: 'var(--chart-cursor)',
  dotFill: 'var(--chart-dot-fill)',
  recorded: 'var(--signal)',
  projected: 'var(--gain)',
  target: 'var(--valve)',
  passing: 'var(--coral)',
  neutral: 'var(--text-faint)',
  good: 'var(--signal)',
  warn: 'var(--valve)',
  bad: 'var(--coral)',
  tick: { fill: 'var(--chart-axis)', fontSize: 11.5 },
  /** Draw-in timing for line and area reveals. */
  animation: { animationDuration: 1100, animationEasing: 'ease-out' as const },
};

/** Y-axis domain that always shows every value plus the passing line, rounded out to multiples of 5. */
export function gradeDomain(values: (number | null | undefined)[], floorAt?: number): [number, number] {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (floorAt !== undefined) numbers.push(floorAt);
  if (!numbers.length) return [0, 100];
  const low = Math.max(0, Math.floor((Math.min(...numbers) - 4) / 5) * 5);
  const high = Math.min(100, Math.ceil((Math.max(...numbers) + 2) / 5) * 5);
  return [low, Math.max(high, low + 10)];
}

export function statusColor(grade: number, passing: number, target: number | null): string {
  if (grade < passing) return chart.bad;
  if (target !== null && grade < target) return chart.warn;
  return chart.good;
}

/** Status of a grade against the passing grade and (optional) target. */
export function gradeStatus(grade: number, passing: number, target: number | null): 'good' | 'warn' | 'bad' {
  if (grade < passing) return 'bad';
  if (target !== null && grade < target) return 'warn';
  return 'good';
}

/** Evenly spaced ticks for a grade domain (every 5 points, or 10 for wide ranges). */
export function gradeTicks([low, high]: [number, number]): number[] {
  const step = high - low > 40 ? 10 : 5;
  const ticks: number[] = [];
  for (let value = Math.ceil(low / step) * step; value <= high; value += step) ticks.push(value);
  return ticks;
}
