import type { Assessment, GradeComponent, GradeOptions, GradingWeights, Subject, SubjectGradingWeights } from '../types/app';
import { transmuteDepEd } from './transmutation';

export const DEFAULT_GRADING_WEIGHTS: GradingWeights = { ww: 30, pt: 50, exam: 20 };
export const COMPONENTS: readonly GradeComponent[] = ['ww', 'pt', 'exam'];
export const COMPONENT_LABELS: Record<GradeComponent, string> = { ww: 'Written Works', pt: 'Performance Tasks', exam: 'Examination' };
export const COMPONENT_SHORT: Record<GradeComponent, string> = { ww: 'WW', pt: 'PT', exam: 'Exam' };
const BASELINE_POSSIBLE_POINTS = 100;
/** Weights are entered as whole or decimal percentages; allow tiny float error when checking the total. */
const WEIGHT_TOTAL_TOLERANCE = 0.01;

export function componentFromLabel(value: unknown): GradeComponent | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'ww' || normalized.includes('written')) return 'ww';
  if (normalized === 'pt' || normalized.includes('performance')) return 'pt';
  if (normalized === 'exam' || normalized.includes('examination') || normalized === 'exams') return 'exam';
  return null;
}

export function weightsTotal(weights: GradingWeights): number {
  return weights.ww + weights.pt + weights.exam;
}

export function weightsAreValid(weights: GradingWeights): boolean {
  return COMPONENTS.every(key => Number.isFinite(weights[key]) && weights[key] >= 0 && weights[key] <= 100)
    && Math.abs(weightsTotal(weights) - 100) <= WEIGHT_TOTAL_TOLERANCE;
}

export function normalizeWeights(value: unknown): GradingWeights {
  if (!value || typeof value !== 'object') return { ...DEFAULT_GRADING_WEIGHTS };
  const candidate = value as Record<string, unknown>;
  const weights = { ww: Number(candidate.ww), pt: Number(candidate.pt), exam: Number(candidate.exam) };
  return weightsAreValid(weights) ? weights : { ...DEFAULT_GRADING_WEIGHTS };
}

export function normalizeSubjectWeights(value: unknown, subjects: Pick<Subject, 'name'>[]): SubjectGradingWeights {
  if (!value || typeof value !== 'object') return Object.fromEntries(subjects.map(subject => [subject.name, { ...DEFAULT_GRADING_WEIGHTS }]));
  const candidate = value as Record<string, unknown>;
  const looksLikeSingleTemplate = 'ww' in candidate || 'pt' in candidate || 'exam' in candidate;
  return Object.fromEntries(subjects.map(subject => [subject.name,
    looksLikeSingleTemplate ? normalizeWeights(candidate) : normalizeWeights(candidate[subject.name]),
  ]));
}

export function scoreAsPercent(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.max(0, Math.min(100, (score / maxScore) * 100));
}

/**
 * Percentage score for one grading component: total points earned / total points possible.
 * This is the DepEd "percentage score" method — larger assessments carry more weight than small ones.
 */
function componentAverage(subject: Subject, component: GradeComponent, assessments: Assessment[], period: string): { average: number; hasGrades: boolean } {
  let earned = subject.hasBaseline === false ? 0 : Math.max(0, Math.min(BASELINE_POSSIBLE_POINTS, subject[component]));
  let possible = subject.hasBaseline === false ? 0 : BASELINE_POSSIBLE_POINTS;

  for (const assessment of assessments) {
    if (assessment.subject !== subject.name || assessment.component !== component || assessment.period !== period) continue;
    const maxScore = Number(assessment.maxScore);
    const score = Number(assessment.score);
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) continue;
    earned += Math.max(0, Math.min(score, maxScore));
    possible += maxScore;
  }

  return { average: possible > 0 ? earned / possible * 100 : 0, hasGrades: possible > 0 };
}

export type SubjectGradeBreakdown = {
  ww: number; pt: number; exam: number;
  wwHasGrades: boolean; ptHasGrades: boolean; examHasGrades: boolean;
  /** Weighted percentage before any transmutation. */
  initialGrade: number;
  /** Reported grade (transmuted when the DepEd scale is selected). Unrounded. */
  grade: number;
  hasGrades: boolean;
};

/**
 * Unrounded grade calculation. Components without any recorded assessment are left out and the remaining
 * weights are re-normalised, so an incomplete grading period is estimated from what has been recorded so far.
 */
export function computeSubjectGrade(base: Subject, assessments: Assessment[], weightsBySubject: SubjectGradingWeights, period: string, options: GradeOptions = {}): SubjectGradeBreakdown {
  const weights = weightsBySubject[base.name] ?? DEFAULT_GRADING_WEIGHTS;
  const ww = componentAverage(base, 'ww', assessments, period);
  const pt = componentAverage(base, 'pt', assessments, period);
  const exam = componentAverage(base, 'exam', assessments, period);
  const availableWeight = (ww.hasGrades ? weights.ww : 0) + (pt.hasGrades ? weights.pt : 0) + (exam.hasGrades ? weights.exam : 0);
  const initialGrade = availableWeight === 0 ? 0
    : (ww.average * (ww.hasGrades ? weights.ww : 0) + pt.average * (pt.hasGrades ? weights.pt : 0) + exam.average * (exam.hasGrades ? weights.exam : 0)) / availableWeight;
  const hasGrades = availableWeight > 0;
  const grade = hasGrades && options.scale === 'deped' ? transmuteDepEd(initialGrade) : initialGrade;
  return {
    ww: ww.average, pt: pt.average, exam: exam.average,
    wwHasGrades: ww.hasGrades, ptHasGrades: pt.hasGrades, examHasGrades: exam.hasGrades,
    initialGrade, grade, hasGrades,
  };
}

const round1 = (value: number) => Number(value.toFixed(1));

/** Subject with its grade fields filled in for `period`. Displayed values are rounded to one decimal. */
export function calculateSubjectGrade(base: Subject, assessments: Assessment[], weightsBySubject: SubjectGradingWeights, period: string, options: GradeOptions = {}): Subject {
  const result = computeSubjectGrade(base, assessments, weightsBySubject, period, options);
  return {
    ...base,
    ww: round1(result.ww),
    pt: round1(result.pt),
    exam: round1(result.exam),
    grade: round1(result.grade),
    hasGrades: result.hasGrades,
    wwHasGrades: result.wwHasGrades,
    ptHasGrades: result.ptHasGrades,
    examHasGrades: result.examHasGrades,
  };
}

export function recalculateSubjects(baseSubjects: Subject[], assessments: Assessment[], weights: SubjectGradingWeights, period: string, options: GradeOptions = {}): Subject[] {
  return baseSubjects.map(subject => calculateSubjectGrade(subject, assessments, weights, period, options));
}

function hypotheticalAssessment(subject: string, component: GradeComponent, score: number, maxScore: number, period: string): Assessment {
  return { id: -1, subject, component, title: 'Hypothetical assessment', score: Math.max(0, Math.min(score, maxScore)), maxScore, date: '', period };
}

export function simulateComponentAverage(subject: Subject, component: GradeComponent, assessments: Assessment[], score: number, maxScore: number, period: string): number {
  return componentAverage(subject, component, [...assessments, hypotheticalAssessment(subject.name, component, score, maxScore, period)], period).average;
}

export function simulateAssessment(
  base: Subject,
  assessments: Assessment[],
  component: GradeComponent,
  score: number,
  maxScore: number,
  weights: SubjectGradingWeights,
  period: string,
  options: GradeOptions = {},
): number {
  return calculateSubjectGrade(base, [...assessments, hypotheticalAssessment(base.name, component, score, maxScore, period)], weights, period, options).grade;
}

export function calculateAverage(subjects: Subject[]): number {
  const gradedSubjects = subjects.filter(subject => subject.hasGrades ?? true);
  if (gradedSubjects.length === 0) return 0;
  return gradedSubjects.reduce((sum, subject) => sum + subject.grade, 0) / gradedSubjects.length;
}
