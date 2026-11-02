import { describe, expect, it } from 'vitest';
import { normalizeAssessments, normalizeSettings, normalizeTasks, removeSubjectFromData, renameSubjectInData, type SubjectLinkedData } from '../records';
import { daysUntil, relativeDay, toISODate } from '../dates';

const data: SubjectLinkedData = {
  assessments: [{ id: 1, subject: 'Sci', component: 'ww', title: 'Q', score: 1, maxScore: 2, date: '2026-01-01', period: 'Quarter 1' }],
  historicalGrades: [{ id: 2, subject: 'Sci', period: 'Quarter 1', grade: 90 }, { id: 3, subject: 'Eng', period: 'Quarter 1', grade: 85 }],
  tasks: [{ id: 4, title: 'Lab', subject: 'Sci', date: '', kind: 'Project', done: false }],
  schedule: [{ id: 5, subject: 'Sci', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }],
  gradingWeights: { Sci: { ww: 20, pt: 60, exam: 20 }, Eng: { ww: 30, pt: 50, exam: 20 } },
  futureGrades: { Sci: { 'Quarter 4': '90' } },
};

describe('subject cascade', () => {
  it('renames a subject in every record type and keeps its weights', () => {
    const result = renameSubjectInData(data, 'Sci', 'Science');
    expect(result.assessments[0].subject).toBe('Science');
    expect(result.historicalGrades.map(item => item.subject)).toEqual(['Science', 'Eng']);
    expect(result.tasks[0].subject).toBe('Science');
    expect(result.schedule[0].subject).toBe('Science');
    expect(result.gradingWeights).toEqual({ Eng: { ww: 30, pt: 50, exam: 20 }, Science: { ww: 20, pt: 60, exam: 20 } });
    expect(result.futureGrades).toEqual({ Science: { 'Quarter 4': '90' } });
    expect(data.assessments[0].subject).toBe('Sci');
  });

  it('removes grade data for a subject but keeps its tasks', () => {
    const result = removeSubjectFromData(data, 'Sci');
    expect(result.assessments).toHaveLength(0);
    expect(result.historicalGrades).toHaveLength(1);
    expect(result.tasks).toEqual([{ ...data.tasks[0], subject: '' }]);
    expect(result.schedule).toHaveLength(0);
    expect(Object.keys(result.gradingWeights)).toEqual(['Eng']);
  });
});

describe('normalisers', () => {
  it('drops malformed assessments and maps component labels', () => {
    expect(normalizeAssessments([{ id: 1, subject: 'A', component: 'Written Works', score: '8', maxScore: 10 }, { subject: 'A', component: 'x', score: 1, maxScore: 1 }, null]))
      .toEqual([{ id: 1, subject: 'A', component: 'ww', title: 'Assessment', score: 8, maxScore: 10, date: '', period: 'Quarter 1' }]);
  });

  it('upgrades legacy tasks with a due date and priority', () => {
    const [task] = normalizeTasks([{ id: 1, title: 'Read', subject: 'A', date: 'Nov 06', kind: 'Homework', done: false }]);
    expect(task.dueDate).toMatch(/^\d{4}-11-06$/);
    expect(task.priority).toBe('normal');
  });

  it('defaults new settings without touching existing ones', () => {
    const settings = normalizeSettings({ period: 'Quarter 3', targetAverage: '90', gradingWeights: { A: { ww: 40, pt: 40, exam: 20 } } }, [{ name: 'A' }]);
    expect(settings).toMatchObject({ period: 'Quarter 3', targetAverage: '90', passingGrade: 75, gradingScale: 'percentage', gradingWeights: { A: { ww: 40, pt: 40, exam: 20 } } });
  });
});

describe('dates', () => {
  it('computes relative days', () => {
    expect(daysUntil('2026-11-05', '2026-11-02')).toBe(3);
    expect(relativeDay('2026-11-03', '2026-11-02')).toBe('Tomorrow');
    expect(relativeDay('2026-10-30', '2026-11-02')).toBe('3 days ago');
    expect(toISODate('2026-01-09')).toBe('2026-01-09');
  });
});
