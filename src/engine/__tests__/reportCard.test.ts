import { describe, expect, it } from 'vitest';
import type { Assessment, HistoricalGrade, Subject } from '../../types/app';
import { applyAssumptions, buildReportCard, gradeTrend, parseGradeInput, projectedGeneralAverage, requiredOverallAverage, scenarioAssumptions, subjectChange, subjectGoals, termAverages, termGrade, yearToDateAverage, type ReportContext } from '../reportCard';
import { QUARTERS } from '../periods';

const subject = (id: number, name: string): Subject => ({ id, name, code: name.slice(0, 3), color: '#000', grade: 0, change: 0, ww: 0, pt: 0, exam: 0, hasBaseline: false });
const A = subject(1, 'Alpha');
const B = subject(2, 'Beta');
const weights = { Alpha: { ww: 30, pt: 50, exam: 20 }, Beta: { ww: 30, pt: 50, exam: 20 } };
const actual = (name: string, period: string, grade: number, id = Math.random()): HistoricalGrade => ({ id, subject: name, period, grade });
const assess = (name: string, period: string, score: number, maxScore: number): Assessment => ({ id: Math.random(), subject: name, component: 'ww', title: 't', score, maxScore, date: '2026-10-01', period });
const terms = [...QUARTERS];

function ctx(partial: Partial<ReportContext>): ReportContext {
  return { subjects: [A, B], assessments: [], historicalGrades: [], weights, futureGrades: {}, ...partial };
}

describe('termGrade precedence', () => {
  it('prefers actual report-card grades, then estimates, then projections', () => {
    const context = ctx({
      historicalGrades: [actual('Alpha', 'Quarter 1', 91)],
      assessments: [assess('Alpha', 'Quarter 1', 5, 10), assess('Alpha', 'Quarter 2', 8, 10)],
      futureGrades: { Alpha: { 'Quarter 2': '99', 'Quarter 3': '88', 'Quarter 4': 'abc' } },
    });
    expect(termGrade(context, A, 'Quarter 1')).toEqual({ grade: 91, source: 'Actual' });
    expect(termGrade(context, A, 'Quarter 2')).toEqual({ grade: 80, source: 'Estimated' });
    expect(termGrade(context, A, 'Quarter 3')).toEqual({ grade: 88, source: 'Projected' });
    expect(termGrade(context, A, 'Quarter 4')).toBeNull();
  });

  it('parses only 0–100 grade input', () => {
    expect(parseGradeInput('')).toBeNull();
    expect(parseGradeInput('100.5')).toBeNull();
    expect(parseGradeInput(' 87.5 ')).toBe(87.5);
  });
});

describe('averages and targets', () => {
  // Q1 & Q2 actual for both subjects; Q3 is current.
  const base = ctx({ historicalGrades: [actual('Alpha', 'Quarter 1', 90), actual('Alpha', 'Quarter 2', 92), actual('Beta', 'Quarter 1', 88), actual('Beta', 'Quarter 2', 86)] });
  const rows = buildReportCard(base, terms);

  it('computes the year-to-date average from recorded grades only', () => {
    const withProjection = buildReportCard({ ...base, futureGrades: { Alpha: { 'Quarter 3': '50' } } }, terms);
    // Alpha (90+92)/2 = 91, Beta (88+86)/2 = 87 → 89; the Q3 projection must not count.
    expect(yearToDateAverage(withProjection, 2)).toBe(89);
  });

  it('computes the average needed in remaining terms', () => {
    // target 90 → 90*2*4 = 720 total; fixed 356; 4 remaining terms → 91
    expect(requiredOverallAverage(rows, 90, 2)).toEqual({ status: 'ok', required: 91, remainingTerms: 4 });
    expect(requiredOverallAverage(rows, null, 2)).toEqual({ status: 'no-target' });
  });

  it('asks for past grades before computing requirements', () => {
    const missing = buildReportCard(ctx({ historicalGrades: [actual('Alpha', 'Quarter 1', 90)] }), terms);
    expect(requiredOverallAverage(missing, 90, 2)).toEqual({ status: 'need-past-grades', missingPastTerms: 3 });
  });

  it('computes per-subject goals', () => {
    const goals = subjectGoals(rows, 90, 2);
    expect(goals[0].needed).toBe(89); // (360 - 182) / 2
    expect(goals[1].needed).toBe(93); // (360 - 174) / 2
  });

  it('does not treat missing terms as zero in the projected average', () => {
    const summary = projectedGeneralAverage(rows);
    expect(summary.average).toBe(89);
    expect(summary.complete).toBe(false);
    expect(summary.show).toBe(false);
    expect(summary.filledTerms).toBe(4);
  });

  it('builds scenarios without overwriting recorded grades', () => {
    const assumptions = scenarioAssumptions(rows, terms, 2, 'realistic');
    expect(assumptions).toEqual({ Alpha: { 'Quarter 3': '91', 'Quarter 4': '91' }, Beta: { 'Quarter 3': '87', 'Quarter 4': '87' } });
    const applied = applyAssumptions(rows, terms, { ...assumptions, Alpha: { ...assumptions.Alpha, 'Quarter 1': '10' } });
    expect(applied[0].terms[0]).toEqual({ grade: 90, source: 'Actual' });
    const summary = projectedGeneralAverage(applied);
    expect(summary.average).toBe(89);
    expect(summary.complete).toBe(true);
    expect(summary.projectedCount).toBe(4);
    expect(scenarioAssumptions(rows, terms, 2, 'optimistic').Alpha['Quarter 3']).toBe('94');
    expect(scenarioAssumptions(rows, terms, 2, 'conservative').Beta['Quarter 4']).toBe('84');
  });

  it('reports term change and per-term averages', () => {
    expect(subjectChange(rows[0], 1)).toBe(2);
    expect(subjectChange(rows[0], 2)).toBeNull();
    expect(termAverages(rows, 4)[0]).toEqual({ average: 89, usesProjection: false });
  });

  it('connects the projected trend line to the last recorded point', () => {
    const projected = buildReportCard({ ...base, futureGrades: { Alpha: { 'Quarter 4': '95' }, Beta: { 'Quarter 4': '85' } } }, terms);
    expect(gradeTrend(projected, terms)).toEqual([
      { period: 'Quarter 1', recorded: 89, projected: null },
      { period: 'Quarter 2', recorded: 89, projected: 89 },
      { period: 'Quarter 3', recorded: null, projected: null },
      { period: 'Quarter 4', recorded: null, projected: 90 },
    ]);
  });
});
