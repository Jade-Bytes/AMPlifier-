export const QUARTERS = ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'] as const;
export const SEMESTERS = ['Semester 1', 'Semester 2'] as const;
export const PERIODS: readonly string[] = [...QUARTERS, ...SEMESTERS];

/** The grading periods that make up the academic year containing `period`. */
export function termPeriodsFor(period: string): string[] {
  return period.startsWith('Semester') ? [...SEMESTERS] : [...QUARTERS];
}

export function periodIndex(period: string): number {
  const index = PERIODS.indexOf(period);
  return index === -1 ? PERIODS.length : index;
}

export function comparePeriods(a: string, b: string): number {
  return periodIndex(a) - periodIndex(b);
}

export function shortPeriod(period: string): string {
  return period.replace('Quarter ', 'Q').replace('Semester ', 'S');
}

export function previousPeriod(period: string): string | null {
  const terms = termPeriodsFor(period);
  const index = terms.indexOf(period);
  return index > 0 ? terms[index - 1] : null;
}
