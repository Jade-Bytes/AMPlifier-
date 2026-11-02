import { describe, expect, it } from 'vitest';
import type { Assessment, Subject } from '../../types/app';
import { calculateAverage, calculateSubjectGrade, computeSubjectGrade, normalizeSubjectWeights, normalizeWeights, simulateAssessment, weightsAreValid } from '../calculator';
import { minimumInitialGradeFor, transmuteDepEd } from '../transmutation';

const subject = (name = 'Science'): Subject => ({ id: 1, name, code: 'SCI', color: '#000', grade: 0, change: 0, ww: 0, pt: 0, exam: 0, hasBaseline: false });
const weights = { Science: { ww: 30, pt: 50, exam: 20 } };
let nextId = 1;
const a = (component: Assessment['component'], score: number, maxScore: number, period = 'Quarter 1', name = 'Science'): Assessment =>
  ({ id: nextId++, subject: name, component, title: 't', score, maxScore, date: '2026-10-01', period });

describe('calculateSubjectGrade', () => {
  it('weights each component by its configured percentage', () => {
    // WW 26/30 = 86.667, PT 42/50 = 84, Exam 17/20 = 85 → .3*86.667 + .5*84 + .2*85 = 85.0
    const result = calculateSubjectGrade(subject(), [a('ww', 18, 20), a('ww', 8, 10), a('pt', 42, 50), a('exam', 17, 20)], weights, 'Quarter 1');
    expect(result.ww).toBe(86.7);
    expect(result.pt).toBe(84);
    expect(result.exam).toBe(85);
    expect(result.grade).toBe(85);
    expect(result.hasGrades).toBe(true);
  });

  it('pools points within a component (percentage-score method), not an average of percentages', () => {
    // 1/1 + 0/9 = 1/10 = 10%, not (100% + 0%) / 2
    expect(calculateSubjectGrade(subject(), [a('ww', 1, 1), a('ww', 0, 9)], weights, 'Quarter 1').ww).toBe(10);
  });

  it('re-normalises weights over components that have records (incomplete grading period)', () => {
    // WW 86.667 (w30) + Exam 85 (w20) → (2600 + 1700) / 50 = 86.0
    const result = calculateSubjectGrade(subject(), [a('ww', 18, 20), a('ww', 8, 10), a('exam', 17, 20)], weights, 'Quarter 1');
    expect(result.grade).toBe(86);
    expect(result.ptHasGrades).toBe(false);
  });

  it('ignores other periods, other subjects, and invalid max scores; clamps over-max scores', () => {
    const result = calculateSubjectGrade(subject(), [a('ww', 10, 10, 'Quarter 2'), a('ww', 5, 10, 'Quarter 1', 'Math'), a('ww', 5, 0), a('ww', 15, 10)], weights, 'Quarter 1');
    expect(result.ww).toBe(100);
    expect(result.grade).toBe(100);
  });

  it('reports no grade when nothing is recorded', () => {
    const result = calculateSubjectGrade(subject(), [], weights, 'Quarter 1');
    expect(result.hasGrades).toBe(false);
    expect(result.grade).toBe(0);
  });

  it('applies DepEd transmutation only when that scale is selected', () => {
    const records = [a('ww', 18, 20), a('ww', 8, 10), a('pt', 42, 50), a('exam', 17, 20)];
    expect(calculateSubjectGrade(subject(), records, weights, 'Quarter 1', { scale: 'deped' }).grade).toBe(90);
    const raw = computeSubjectGrade(subject(), records, weights, 'Quarter 1', { scale: 'deped' });
    expect(raw.initialGrade).toBeCloseTo(85, 6);
  });

  it('falls back to default weights for an unknown subject', () => {
    const result = calculateSubjectGrade(subject('Art'), [a('ww', 10, 10, 'Quarter 1', 'Art'), a('pt', 0, 10, 'Quarter 1', 'Art')], {}, 'Quarter 1');
    expect(result.grade).toBe(37.5); // (100*30 + 0*50) / 80
  });
});

describe('transmuteDepEd', () => {
  it.each([[100, 100], [99.99, 99], [98.4, 99], [85, 90], [84, 90], [83.99, 89], [75.99, 84], [76, 85], [60, 75], [59.99, 74], [4, 61], [0, 60], [-5, 60], [120, 100]])('%f → %i', (initial, expected) => {
    expect(transmuteDepEd(initial)).toBe(expected);
  });

  it('finds the lowest initial grade for a transmuted target', () => {
    expect(minimumInitialGradeFor(90)).toBe(84);
    expect(minimumInitialGradeFor(75)).toBe(60);
    expect(minimumInitialGradeFor(60)).toBe(0);
    expect(minimumInitialGradeFor(101)).toBeNull();
  });
});

describe('weights', () => {
  it('accepts weights that total 100 within float tolerance', () => {
    expect(weightsAreValid({ ww: 33.3, pt: 33.3, exam: 33.4 })).toBe(true);
    expect(weightsAreValid({ ww: 30, pt: 50, exam: 21 })).toBe(false);
    expect(weightsAreValid({ ww: -10, pt: 90, exam: 20 })).toBe(false);
  });

  it('replaces invalid weights with defaults and returns copies', () => {
    const first = normalizeWeights({ ww: 50, pt: 50, exam: 50 });
    expect(first).toEqual({ ww: 30, pt: 50, exam: 20 });
    first.ww = 99;
    expect(normalizeWeights(null).ww).toBe(30);
  });

  it('migrates a single legacy template to every subject', () => {
    expect(normalizeSubjectWeights({ ww: 40, pt: 40, exam: 20 }, [{ name: 'A' }, { name: 'B' }])).toEqual({ A: { ww: 40, pt: 40, exam: 20 }, B: { ww: 40, pt: 40, exam: 20 } });
  });
});

describe('simulation safety', () => {
  it('never mutates the real assessment list', () => {
    const records = Object.freeze([a('ww', 18, 20)]) as unknown as Assessment[];
    const before = JSON.stringify(records);
    const simulated = simulateAssessment(subject(), records, 'exam', 20, 20, weights, 'Quarter 1');
    expect(simulated).toBe(94); // (90*30 + 100*20) / 50
    expect(JSON.stringify(records)).toBe(before);
  });

  it('averages only subjects that have grades', () => {
    expect(calculateAverage([{ ...subject(), grade: 90, hasGrades: true }, { ...subject('B'), grade: 0, hasGrades: false }, { ...subject('C'), grade: 80, hasGrades: true }])).toBe(85);
  });
});
