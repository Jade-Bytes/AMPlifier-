import type { Assessment, FutureGrades, GradeOptions, HistoricalGrade, Subject, SubjectGradingWeights, TermGrade } from '../types/app';
import { computeSubjectGrade } from './calculator';

/** Everything needed to derive a term-by-term report card. Pure data: nothing here is mutated. */
export type ReportContext = {
  subjects: Subject[];
  assessments: Assessment[];
  historicalGrades: HistoricalGrade[];
  weights: SubjectGradingWeights;
  futureGrades: FutureGrades;
  options?: GradeOptions;
};

export type ReportCardRow = { subject: Subject; terms: (TermGrade | null)[] };

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Parses a 0–100 grade typed by the user. Blank or invalid input returns null. */
export function parseGradeInput(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

/**
 * Grade for one subject and term, by precedence:
 * 1. Actual — a report-card grade the student entered (official record).
 * 2. Estimated — calculated from assessments recorded in that term.
 * 3. Projected — the student's assumption for a term with no data yet.
 */
export function termGrade(ctx: ReportContext, subject: Subject, term: string): TermGrade | null {
  const official = ctx.historicalGrades.find(item => item.subject === subject.name && item.period === term);
  if (official) return { grade: official.grade, source: 'Actual' };
  const calculated = computeSubjectGrade(subject, ctx.assessments, ctx.weights, term, ctx.options);
  if (calculated.hasGrades) return { grade: Number(calculated.grade.toFixed(1)), source: 'Estimated' };
  const projected = parseGradeInput(ctx.futureGrades[subject.name]?.[term]);
  return projected === null ? null : { grade: projected, source: 'Projected' };
}

export function buildReportCard(ctx: ReportContext, termPeriods: string[]): ReportCardRow[] {
  return ctx.subjects.map(subject => ({ subject, terms: termPeriods.map(term => termGrade(ctx, subject, term)) }));
}

const recorded = (entry: TermGrade | null): entry is TermGrade => entry !== null && entry.source !== 'Projected';

/** Mean of each subject's recorded (actual + estimated) grades through the current term, then averaged. */
export function yearToDateAverage(rows: ReportCardRow[], currentIndex: number): number | null {
  const subjectMeans = rows
    .map(row => mean(row.terms.slice(0, currentIndex + 1).filter(recorded).map(entry => entry.grade)))
    .filter((value): value is number => value !== null);
  return mean(subjectMeans);
}

export type ProjectionSummary = {
  average: number | null;
  projectedCount: number;
  filledTerms: number;
  totalTerms: number;
  /** Every subject has a grade (of any source) for every term. */
  complete: boolean;
  /** Worth showing: either something is projected or the year is fully graded. */
  show: boolean;
};

/** Final general average including projections. Terms with no grade at all are left out, not counted as zero. */
export function projectedGeneralAverage(rows: ReportCardRow[]): ProjectionSummary {
  const subjectMeans = rows
    .map(row => mean(row.terms.filter((entry): entry is TermGrade => entry !== null).map(entry => entry.grade)))
    .filter((value): value is number => value !== null);
  const projectedCount = rows.reduce((sum, row) => sum + row.terms.filter(entry => entry?.source === 'Projected').length, 0);
  const filledTerms = rows.reduce((sum, row) => sum + row.terms.filter(Boolean).length, 0);
  const totalTerms = rows.reduce((sum, row) => sum + row.terms.length, 0);
  const complete = rows.length > 0 && filledTerms === totalTerms;
  return { average: mean(subjectMeans), projectedCount, filledTerms, totalTerms, complete, show: projectedCount > 0 || complete };
}

export type RequiredAverage =
  | { status: 'no-target' }
  | { status: 'need-past-grades'; missingPastTerms: number }
  | { status: 'nothing-remaining' }
  | { status: 'ok'; required: number; remainingTerms: number };

/**
 * Average needed across every unresolved current/future term (all subjects) to reach `target` as the final
 * general average. Only Actual grades are treated as fixed; current estimates can still change.
 */
export function requiredOverallAverage(rows: ReportCardRow[], target: number | null, currentIndex: number): RequiredAverage {
  if (target === null) return { status: 'no-target' };
  const missingPastTerms = rows.reduce((sum, row) => sum + row.terms.slice(0, currentIndex).filter(entry => entry?.source !== 'Actual').length, 0);
  if (missingPastTerms > 0) return { status: 'need-past-grades', missingPastTerms };
  const remainingTerms = rows.reduce((sum, row) => sum + row.terms.slice(currentIndex).filter(entry => entry?.source !== 'Actual').length, 0);
  if (remainingTerms === 0) return { status: 'nothing-remaining' };
  const termCount = rows[0]?.terms.length ?? 0;
  const fixedSum = rows.reduce((sum, row) => sum + row.terms.reduce((rowSum, entry) => rowSum + (entry?.source === 'Actual' ? entry.grade : 0), 0), 0);
  return { status: 'ok', required: (target * rows.length * termCount - fixedSum) / remainingTerms, remainingTerms };
}

export type SubjectGoal = { subject: Subject; terms: (TermGrade | null)[]; needed: number | null; priorComplete: boolean; unresolvedCount: number };

/** Per-subject grade needed in each unresolved term for that subject's final grade to reach `target`. */
export function subjectGoals(rows: ReportCardRow[], target: number | null, currentIndex: number): SubjectGoal[] {
  return rows.map(row => {
    const priorComplete = row.terms.slice(0, currentIndex).every(entry => entry?.source === 'Actual');
    const fixedSum = row.terms.reduce((sum, entry) => sum + (entry?.source === 'Actual' ? entry.grade : 0), 0);
    const unresolvedCount = row.terms.slice(currentIndex).filter(entry => entry?.source !== 'Actual').length;
    const needed = target !== null && priorComplete && unresolvedCount > 0 ? (target * row.terms.length - fixedSum) / unresolvedCount : null;
    return { subject: row.subject, terms: row.terms, needed, priorComplete, unresolvedCount };
  });
}

/** General average for each term column. Uses projections for a term only when that term contains one. */
export function termAverages(rows: ReportCardRow[], termCount: number): { average: number | null; usesProjection: boolean }[] {
  return Array.from({ length: termCount }, (_, index) => {
    const entries = rows.map(row => row.terms[index]).filter((entry): entry is TermGrade => entry !== null);
    const usesProjection = entries.some(entry => entry.source === 'Projected');
    return { average: mean((usesProjection ? entries : entries.filter(recorded)).map(entry => entry.grade)), usesProjection };
  });
}

/** Change in a subject's recorded grade from the previous term to the current one. */
export function subjectChange(row: ReportCardRow, currentIndex: number): number | null {
  const current = row.terms[currentIndex];
  const previous = currentIndex > 0 ? row.terms[currentIndex - 1] : null;
  return recorded(current) && recorded(previous) ? current.grade - previous.grade : null;
}

export type TrendPoint = { period: string; recorded: number | null; projected: number | null };

/**
 * Average per term for charting. `recorded` uses actual + estimated grades only. `projected` covers terms that
 * include assumptions, starting from the last recorded point so the two lines connect.
 */
export function gradeTrend(rows: ReportCardRow[], termPeriods: string[]): TrendPoint[] {
  const points = termPeriods.map((period, index) => {
    const entries = rows.map(row => row.terms[index]).filter((entry): entry is TermGrade => entry !== null);
    const recordedValues = entries.filter(recorded).map(entry => entry.grade);
    const hasProjection = entries.some(entry => entry.source === 'Projected');
    return { period, recorded: mean(recordedValues), projected: hasProjection ? mean(entries.map(entry => entry.grade)) : null };
  });
  const firstProjected = points.findIndex(point => point.projected !== null);
  const anchor = firstProjected > 0 ? points.slice(0, firstProjected).map(point => point.recorded !== null).lastIndexOf(true) : -1;
  if (anchor >= 0) points[anchor] = { ...points[anchor], projected: points[anchor].recorded };
  return points;
}

export type ScenarioKey = 'conservative' | 'realistic' | 'optimistic';
export const SCENARIOS: { key: ScenarioKey; label: string; description: string }[] = [
  { key: 'conservative', label: 'Conservative', description: 'Each subject’s lowest recorded term grade, minus 2 points' },
  { key: 'realistic', label: 'Realistic', description: 'Each subject’s average of recorded term grades' },
  { key: 'optimistic', label: 'Optimistic', description: 'Each subject’s highest recorded term grade, plus 2 points' },
];

const clampGrade = (value: number) => Math.max(0, Math.min(100, Number(value.toFixed(1))));

/**
 * Assumptions for every term from `currentIndex` onward that has no recorded grade yet, derived from each
 * subject's own recorded grades (falling back to the overall recorded average for subjects without any).
 */
export function scenarioAssumptions(rows: ReportCardRow[], termPeriods: string[], currentIndex: number, key: ScenarioKey): FutureGrades {
  const allRecorded = rows.flatMap(row => row.terms.filter(recorded).map(entry => entry.grade));
  const result: FutureGrades = {};
  for (const row of rows) {
    const own = row.terms.filter(recorded).map(entry => entry.grade);
    const basis = own.length ? own : allRecorded;
    if (!basis.length) continue;
    const value = key === 'conservative' ? Math.min(...basis) - 2 : key === 'optimistic' ? Math.max(...basis) + 2 : mean(basis)!;
    termPeriods.forEach((term, index) => {
      if (index < currentIndex || recorded(row.terms[index])) return;
      result[row.subject.name] = { ...(result[row.subject.name] ?? {}), [term]: String(clampGrade(value)) };
    });
  }
  return result;
}

/** Replaces projected/empty cells with the given assumptions. Recorded grades are never overwritten. */
export function applyAssumptions(rows: ReportCardRow[], termPeriods: string[], assumptions: FutureGrades): ReportCardRow[] {
  return rows.map(row => ({
    subject: row.subject,
    terms: row.terms.map((entry, index) => {
      if (recorded(entry)) return entry;
      const value = parseGradeInput(assumptions[row.subject.name]?.[termPeriods[index]]);
      return value === null ? entry : { grade: value, source: 'Projected' as const };
    }),
  }));
}
