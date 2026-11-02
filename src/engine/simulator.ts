import type { Assessment, GradeComponent, GradeOptions, Subject, SubjectGradingWeights } from '../types/app';
import { calculateSubjectGrade, computeSubjectGrade } from './calculator';

/** A what-if assessment. It is only ever combined with copies of the real records, never saved. */
export type HypotheticalAssessment = { id: string; component: GradeComponent; score: number; maxScore: number };

function toAssessments(subject: string, period: string, items: HypotheticalAssessment[]): Assessment[] {
  return items
    .filter(item => Number.isFinite(item.score) && Number.isFinite(item.maxScore) && item.maxScore > 0)
    .map((item, index) => ({
      id: -(index + 1), subject, component: item.component, title: 'Hypothetical assessment',
      score: Math.max(0, Math.min(item.score, item.maxScore)), maxScore: item.maxScore, date: '', period,
    }));
}

/** Subject grade for `period` with the hypothetical assessments added to (a copy of) the real ones. */
export function simulateSubject(base: Subject, assessments: readonly Assessment[], hypotheticals: HypotheticalAssessment[], weights: SubjectGradingWeights, period: string, options: GradeOptions = {}): Subject {
  return calculateSubjectGrade(base, [...assessments, ...toAssessments(base.name, period, hypotheticals)], weights, period, options);
}

export type RequiredScore =
  | { status: 'invalid' }
  | { status: 'already-met'; currentGrade: number; gradeAtZero: number }
  | { status: 'possible'; score: number; percent: number; resultingGrade: number }
  | { status: 'impossible'; bestGrade: number };

/**
 * Minimum score on one more assessment (out of `maxScore`) so the subject's displayed grade for `period`
 * reaches `target`. The grade never decreases as the score rises, so a binary search is exact to 0.01 pt.
 * Comparisons use the one-decimal grade the app displays.
 */
export function requiredScore(
  base: Subject,
  assessments: readonly Assessment[],
  pending: HypotheticalAssessment[],
  component: GradeComponent,
  maxScore: number,
  target: number,
  weights: SubjectGradingWeights,
  period: string,
  options: GradeOptions = {},
): RequiredScore {
  if (!Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(target) || target < 0 || target > 100) return { status: 'invalid' };
  const gradeWith = (score: number) => simulateSubject(base, assessments, [...pending, { id: 'solve', component, score, maxScore }], weights, period, options).grade;
  const gradeAtZero = gradeWith(0);
  if (gradeAtZero >= target) {
    const current = computeSubjectGrade(base, [...assessments, ...toAssessments(base.name, period, pending)], weights, period, options);
    return { status: 'already-met', currentGrade: Number(current.grade.toFixed(1)), gradeAtZero };
  }
  const best = gradeWith(maxScore);
  if (best < target) return { status: 'impossible', bestGrade: best };
  // Integer search over hundredths of a point: `low` is always insufficient, `high` always sufficient.
  let low = 0;
  let high = Math.ceil(maxScore * 100);
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (gradeWith(mid / 100) >= target) high = mid; else low = mid;
  }
  const score = Math.min(maxScore, high / 100);
  return { status: 'possible', score, percent: score / maxScore * 100, resultingGrade: gradeWith(score) };
}
