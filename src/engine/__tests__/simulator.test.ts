import { describe, expect, it } from 'vitest';
import type { Assessment, Subject } from '../../types/app';
import { requiredScore, simulateSubject } from '../simulator';
import { academicInsights } from '../insights';

const science: Subject = { id: 1, name: 'Science', code: 'SCI', color: '#000', grade: 0, change: 0, ww: 0, pt: 0, exam: 0, hasBaseline: false };
const weights = { Science: { ww: 30, pt: 50, exam: 20 } };
// WW 26/30 = 86.667% → grade 86.7 with only WW recorded
const records: Assessment[] = [
  { id: 1, subject: 'Science', component: 'ww', title: 'Quiz 1', score: 18, maxScore: 20, date: '2026-10-01', period: 'Quarter 1' },
  { id: 2, subject: 'Science', component: 'ww', title: 'Quiz 2', score: 8, maxScore: 10, date: '2026-10-02', period: 'Quarter 1' },
];

describe('simulateSubject', () => {
  it('combines several hypothetical scores without touching real records', () => {
    const snapshot = JSON.stringify(records);
    const result = simulateSubject(science, records, [{ id: 'x', component: 'exam', score: 20, maxScore: 20 }, { id: 'y', component: 'pt', score: 40, maxScore: 50 }], weights, 'Quarter 1');
    // .3*86.667 + .5*80 + .2*100 = 86.0
    expect(result.grade).toBe(86);
    expect(JSON.stringify(records)).toBe(snapshot);
    expect(records).toHaveLength(2);
  });
});

describe('requiredScore', () => {
  it('finds the minimum score that reaches the displayed target', () => {
    // (2600 + 100s) / 50 ≥ 89.95 → s ≥ 18.975 → 18.98
    const result = requiredScore(science, records, [], 'exam', 20, 90, weights, 'Quarter 1');
    expect(result.status).toBe('possible');
    if (result.status !== 'possible') return;
    expect(result.score).toBe(18.98);
    expect(result.resultingGrade).toBeGreaterThanOrEqual(90);
    expect(simulateSubject(science, records, [{ id: 'z', component: 'exam', score: 18.97, maxScore: 20 }], weights, 'Quarter 1').grade).toBeLessThan(90);
  });

  it('reports when the target is out of reach or already met', () => {
    expect(requiredScore(science, records, [], 'exam', 20, 99, weights, 'Quarter 1')).toEqual({ status: 'impossible', bestGrade: 92 });
    expect(requiredScore(science, records, [], 'exam', 20, 50, weights, 'Quarter 1').status).toBe('already-met');
    expect(requiredScore(science, records, [], 'exam', 0, 90, weights, 'Quarter 1').status).toBe('invalid');
  });

  it('works on the DepEd scale', () => {
    // Need transmuted 90 → initial ≥ 84 → (2600 + 100s)/50 ≥ 84 → s ≥ 16
    const result = requiredScore(science, records, [], 'exam', 20, 90, weights, 'Quarter 1', { scale: 'deped' });
    expect(result).toMatchObject({ status: 'possible', score: 16 });
  });
});

describe('academicInsights', () => {
  it('puts below-passing subjects first and explains with numbers', () => {
    const subjects: Subject[] = [
      { ...science, grade: 72, hasGrades: true, ww: 70, pt: 72, exam: 75, wwHasGrades: true, ptHasGrades: true, examHasGrades: true },
      { ...science, id: 2, name: 'English', grade: 93, hasGrades: true, ww: 95, pt: 92, exam: 90, wwHasGrades: true, ptHasGrades: true, examHasGrades: true },
    ];
    const result = academicInsights({ subjects, assessments: [], period: 'Quarter 1', passingGrade: 75, changes: { Science: -3, English: null } });
    expect(result[0]).toMatchObject({ severity: 'attention', title: 'Science is below passing', detail: 'Estimated 72.0 against a passing grade of 75. Down 3.0 from the previous term.' });
    expect(result.some(item => item.id === 'decline-Science')).toBe(false);
    expect(result.at(-1)?.severity).toBe('positive');
  });

  it('returns nothing without grades', () => {
    expect(academicInsights({ subjects: [science], assessments: [], period: 'Quarter 1', passingGrade: 75, changes: {} })).toEqual([]);
  });
});
