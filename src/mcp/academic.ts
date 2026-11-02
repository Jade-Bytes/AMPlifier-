import { calculateAverage, COMPONENT_LABELS, COMPONENTS, DEFAULT_GRADING_WEIGHTS, recalculateSubjects, scoreAsPercent } from '../engine/calculator';
import { comparePeriods, previousPeriod } from '../engine/periods';
import { applyAssumptions, projectedGeneralAverage, SCENARIOS, scenarioAssumptions, subjectGoals, termAverages, type ProjectionSummary, type RequiredAverage, type ScenarioKey } from '../engine/reportCard';
import { requiredScore, simulateSubject, type HypotheticalAssessment } from '../engine/simulator';
import { daysUntil, todayISO } from '../lib/dates';
import { deriveAcademicModel, type AcademicModel } from '../state/academicModel';
import type { FutureGrades, GradeComponent, Subject, TermGrade } from '../types/app';
import type { McpWorkspace } from './backup';

/*
 * Tool logic for the MCP server. Every figure comes from `src/engine` (via the same `deriveAcademicModel` the app
 * uses); this file only selects, validates and shapes data. Nothing here mutates the workspace it is given.
 */

/** A problem with the tool arguments, reported back to the AI client as a tool error. */
export class ToolInputError extends Error {}

/** Two decimals is plenty for an AI client and avoids float noise such as 86.66666666666667. */
const round = (value: number | null | undefined) => value === null || value === undefined ? null : Number(value.toFixed(2));
const termOut = (period: string, entry: TermGrade | null) => ({ period, grade: entry?.grade ?? null, source: entry?.source ?? null });
const projectionOut = (summary: ProjectionSummary) => ({ average: round(summary.average), projectedTerms: summary.projectedCount, filledTerms: summary.filledTerms, totalTerms: summary.totalTerms, complete: summary.complete });
const requiredOut = (required: RequiredAverage) => required.status === 'ok' ? { ...required, required: round(required.required) } : required;

export function modelFor(ws: McpWorkspace, today = todayISO()): AcademicModel {
  return deriveAcademicModel(ws, today);
}

export function findSubject(ws: McpWorkspace, name: string): Subject {
  const wanted = name.trim().toLowerCase();
  const match = ws.subjects.find(subject => subject.name.toLowerCase() === wanted) ?? ws.subjects.find(subject => subject.code.toLowerCase() === wanted);
  if (!match) throw new ToolInputError(`Unknown subject "${name}". Subjects: ${ws.subjects.map(subject => subject.name).join(', ') || '(none)'}.`);
  return match;
}

function resolvePeriod(model: AcademicModel, period: string | undefined): string {
  if (period === undefined) return model.period;
  const match = model.termPeriods.find(term => term.toLowerCase() === period.trim().toLowerCase());
  if (!match) throw new ToolInputError(`Unknown period "${period}". This school year uses: ${model.termPeriods.join(', ')}.`);
  return match;
}

function gradeStatus(subject: Subject, passingGrade: number) {
  if (!subject.hasGrades) return 'no-grades';
  return subject.grade >= passingGrade ? 'passing' : 'below-passing';
}

/* READ */

export function academicOverview(ws: McpWorkspace, today = todayISO()) {
  const model = modelFor(ws, today);
  const { profile, settings } = ws;
  return {
    student: profile?.displayName ?? null,
    school: profile?.schoolName || null,
    gradeLevel: profile?.gradeLevel || null,
    section: profile?.section || null,
    academicYear: profile?.academicYear || null,
    backupExportedAt: ws.exportedAt,
    currentPeriod: model.period,
    termPeriods: model.termPeriods,
    gradingScale: settings.gradingScale,
    passingGrade: settings.passingGrade,
    targetGeneralAverage: model.target,
    currentPeriodAverage: round(model.currentAverage),
    yearToDateAverage: round(model.yearToDate),
    projectedFinalAverage: projectionOut(model.projection),
    requiredAverageForTarget: requiredOut(model.required),
    subjects: model.current.map(subject => ({
      name: subject.name,
      currentGrade: subject.hasGrades ? subject.grade : null,
      status: gradeStatus(subject, settings.passingGrade),
      changeFromPreviousTerm: round(model.changes[subject.name]),
    })),
    insights: model.insights.map(({ severity, title, detail, subject }) => ({ severity, title, detail, ...(subject ? { subject } : {}) })),
    upcoming: { open: model.upcoming.length, overdue: model.overdueCount, dueWithin7Days: model.dueSoonCount },
  };
}

export function subjectGrades(ws: McpWorkspace, subjectName: string, today = todayISO()) {
  const base = findSubject(ws, subjectName);
  const model = modelFor(ws, today);
  const current = model.current.find(subject => subject.name === base.name)!;
  const row = model.rows.find(item => item.subject.name === base.name)!;
  const goal = model.goals.find(item => item.subject.name === base.name)!;
  const weights = model.weights[base.name] ?? DEFAULT_GRADING_WEIGHTS;
  return {
    subject: base.name,
    currentPeriod: model.period,
    currentGrade: current.hasGrades ? current.grade : null,
    status: gradeStatus(current, ws.settings.passingGrade),
    gradingScale: ws.settings.gradingScale,
    components: COMPONENTS.map(component => ({
      component, label: COMPONENT_LABELS[component], weight: weights[component],
      average: current[`${component}HasGrades`] ? current[component] : null,
      assessmentsThisPeriod: ws.assessments.filter(item => item.subject === base.name && item.component === component && item.period === model.period).length,
    })),
    terms: row.terms.map((entry, index) => termOut(model.termPeriods[index], entry)),
    changeFromPreviousTerm: round(model.changes[base.name]),
    targetGeneralAverage: model.target,
    neededPerRemainingTermForTarget: round(goal.needed),
  };
}

export type HistoryQuery = { subject?: string; period?: string; component?: GradeComponent; limit?: number };

export function assessmentHistory(ws: McpWorkspace, query: HistoryQuery = {}) {
  const subject = query.subject === undefined ? undefined : findSubject(ws, query.subject).name;
  const period = query.period === undefined ? undefined : resolvePeriod(modelFor(ws), query.period);
  const matches = ws.assessments
    .filter(item => (!subject || item.subject === subject) && (!period || item.period === period) && (!query.component || item.component === query.component))
    .sort((a, b) => comparePeriods(b.period, a.period) || b.date.localeCompare(a.date) || b.id - a.id);
  const limited = query.limit ? matches.slice(0, query.limit) : matches;
  return {
    filters: { subject: subject ?? null, period: period ?? null, component: query.component ?? null },
    total: matches.length,
    returned: limited.length,
    assessments: limited.map(item => ({
      subject: item.subject, period: item.period, component: item.component, componentLabel: COMPONENT_LABELS[item.component],
      title: item.title, score: item.score, maxScore: item.maxScore, percent: round(scoreAsPercent(item.score, item.maxScore)), date: item.date || null,
    })),
  };
}

export type UpcomingQuery = { daysAhead?: number; includeOverdue?: boolean };

export function upcomingAssessments(ws: McpWorkspace, query: UpcomingQuery = {}, today = todayISO()) {
  const { includeOverdue = true, daysAhead } = query;
  const items = modelFor(ws, today).upcoming
    .map(item => ({ ...item, daysUntil: daysUntil(item.date, today) }))
    .filter(item => (includeOverdue || !item.overdue) && (daysAhead === undefined || item.daysUntil <= daysAhead));
  return {
    today,
    count: items.length,
    items: items.map(({ title, subject, kind, date, source, overdue, daysUntil }) => ({ title, subject: subject || null, kind, date, source, overdue, daysUntil })),
  };
}

/* SIMULATE — every function below works on copies; recorded data is never modified. */

export type HypotheticalInput = { component: GradeComponent; score: number; maxScore: number; title?: string };

const toHypotheticals = (items: HypotheticalInput[]): HypotheticalAssessment[] => items.map((item, index) => {
  if (!(item.maxScore > 0)) throw new ToolInputError(`Hypothetical #${index + 1}: maxScore must be greater than 0.`);
  if (item.score < 0 || item.score > item.maxScore) throw new ToolInputError(`Hypothetical #${index + 1}: score must be between 0 and maxScore (${item.maxScore}).`);
  return { id: `mcp-${index}`, component: item.component, score: item.score, maxScore: item.maxScore };
});

const breakdown = (subject: Subject) => ({
  grade: subject.hasGrades ? subject.grade : null,
  ww: subject.wwHasGrades ? subject.ww : null, pt: subject.ptHasGrades ? subject.pt : null, exam: subject.examHasGrades ? subject.exam : null,
});

export function simulateGrade(ws: McpWorkspace, input: { subject: string; period?: string; hypotheticals: HypotheticalInput[] }) {
  const base = findSubject(ws, input.subject);
  const model = modelFor(ws);
  const period = resolvePeriod(model, input.period);
  const hypotheticals = toHypotheticals(input.hypotheticals);
  const before = simulateSubject(base, ws.assessments, [], model.weights, period, model.options);
  const after = simulateSubject(base, ws.assessments, hypotheticals, model.weights, period, model.options);
  const others = recalculateSubjects(ws.subjects, ws.assessments, model.weights, period, model.options);
  const withAfter = others.map(subject => subject.name === base.name ? after : subject);
  const periodAverage = (subjects: Subject[]) => subjects.some(subject => subject.hasGrades) ? round(calculateAverage(subjects)) : null;
  return {
    subject: base.name,
    period,
    hypotheticals: input.hypotheticals.map(item => ({ ...item, componentLabel: COMPONENT_LABELS[item.component], percent: round(scoreAsPercent(item.score, item.maxScore)) })),
    before: breakdown(before),
    after: breakdown(after),
    gradeChange: before.hasGrades ? round(after.grade - before.grade) : null,
    periodAverage: { before: periodAverage(others), after: periodAverage(withAfter) },
    note: 'Hypothetical only. No AMPlifier records were changed.',
  };
}

export function gradeRequirements(ws: McpWorkspace, input: { subject: string; component: GradeComponent; maxScore: number; target: number; period?: string; pending?: HypotheticalInput[] }) {
  const base = findSubject(ws, input.subject);
  const model = modelFor(ws);
  const period = resolvePeriod(model, input.period);
  const result = requiredScore(base, ws.assessments, toHypotheticals(input.pending ?? []), input.component, input.maxScore, input.target, model.weights, period, model.options);
  const goal = subjectGoals(model.rows, input.target, model.currentIndex).find(item => item.subject.name === base.name)!;
  return {
    subject: base.name,
    period,
    target: input.target,
    nextAssessment: { component: input.component, componentLabel: COMPONENT_LABELS[input.component], maxScore: input.maxScore },
    result: result.status === 'possible' ? { ...result, percent: round(result.percent) } : result,
    finalGrade: {
      description: `Grade needed in each remaining ${model.termPeriods[0].split(' ')[0].toLowerCase()} for ${base.name}'s final grade to reach ${input.target}. Only official (Actual) report-card grades count as fixed.`,
      neededPerRemainingTerm: round(goal.needed),
      remainingTerms: goal.unresolvedCount,
      earlierTermsAllOfficial: goal.priorComplete,
    },
    note: 'Hypothetical only. No AMPlifier records were changed.',
  };
}

export type ForecastScenario = ScenarioKey | 'saved' | 'all';

function validateAssumptions(ws: McpWorkspace, model: AcademicModel, assumptions: Record<string, Record<string, number>>): FutureGrades {
  return Object.fromEntries(Object.entries(assumptions).map(([subject, periods]) => [
    findSubject(ws, subject).name,
    Object.fromEntries(Object.entries(periods).map(([period, grade]) => {
      if (!(grade >= 0 && grade <= 100)) throw new ToolInputError(`Assumed grade for ${subject} ${period} must be between 0 and 100.`);
      return [resolvePeriod(model, period), String(grade)];
    })),
  ]));
}

export function forecastGeneralAverage(ws: McpWorkspace, input: { scenario?: ForecastScenario; assumptions?: Record<string, Record<string, number>> } = {}) {
  const model = modelFor(ws);
  const scenario = input.scenario ?? 'all';
  const scenarios = SCENARIOS.filter(item => scenario === 'all' || scenario === item.key).map(item => {
    const assumptions = scenarioAssumptions(model.rows, model.termPeriods, model.currentIndex, item.key);
    return { key: item.key, label: item.label, basis: item.description, projection: projectionOut(projectedGeneralAverage(applyAssumptions(model.rows, model.termPeriods, assumptions))), assumptions };
  });
  const custom = input.assumptions ? (() => {
    const assumptions = validateAssumptions(ws, model, input.assumptions);
    return { assumptions, projection: projectionOut(projectedGeneralAverage(applyAssumptions(model.rows, model.termPeriods, assumptions))) };
  })() : null;
  return {
    currentPeriod: model.period,
    termPeriods: model.termPeriods,
    yearToDateAverage: round(model.yearToDate),
    targetGeneralAverage: model.target,
    requiredAverageForTarget: requiredOut(model.required),
    ...(scenario === 'all' || scenario === 'saved' ? { saved: { basis: 'Assumptions saved in the app (Forecast page)', projection: projectionOut(model.projection) } } : {}),
    scenarios,
    ...(custom ? { custom } : {}),
    note: 'Assumptions only fill terms without an Actual or Estimated grade; recorded grades are never overwritten, and nothing is saved.',
  };
}

export function compareQuarters(ws: McpWorkspace, input: { from?: string; to?: string } = {}) {
  const model = modelFor(ws);
  const to = resolvePeriod(model, input.to);
  const from = input.from === undefined ? previousPeriod(to) : resolvePeriod(model, input.from);
  if (!from) throw new ToolInputError(`${to} is the first term; pass "from" and "to" explicitly to compare two terms.`);
  const fromIndex = model.termPeriods.indexOf(from);
  const toIndex = model.termPeriods.indexOf(to);
  const averages = termAverages(model.rows, model.termPeriods.length);
  const subjects = model.rows.map(row => {
    const a = row.terms[fromIndex];
    const b = row.terms[toIndex];
    return { subject: row.subject.name, from: termOut(from, a), to: termOut(to, b), change: a && b ? round(b.grade - a.grade) : null };
  });
  const comparable = subjects.filter(item => item.change !== null).sort((a, b) => b.change! - a.change!);
  const best = comparable[0];
  const worst = comparable.at(-1);
  return {
    from, to,
    termAverages: model.termPeriods.map((period, index) => ({ period, average: round(averages[index].average), includesProjections: averages[index].usesProjection })),
    averageChange: averages[fromIndex].average !== null && averages[toIndex].average !== null ? round(averages[toIndex].average! - averages[fromIndex].average!) : null,
    subjects,
    mostImproved: best && best.change! > 0 ? best.subject : null,
    largestDrop: worst && worst.change! < 0 ? worst.subject : null,
    note: 'Sources: Actual = official report-card grade, Estimated = calculated from recorded assessments, Projected = an assumption.',
  };
}
