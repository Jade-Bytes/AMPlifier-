/// <reference types="node" />
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { applyAssumptions, projectedGeneralAverage, scenarioAssumptions } from '../../engine/reportCard';
import { deriveAcademicModel } from '../../state/academicModel';
import { buildDemoWorkspace } from '../../state/demoData';
import { academicOverview, upcomingAssessments } from '../academic';
import { BackupError, parseBackup, parseBackupText, type McpWorkspace } from '../backup';
import { createAmplifierMcpServer, TOOL_PERMISSIONS } from '../server';

const subject = (id: number, name: string) => ({ id, name, code: name.slice(0, 3).toUpperCase(), color: '#000', grade: 0, change: 0, ww: 0, pt: 0, exam: 0, hasBaseline: false });

/** A backup exactly as Settings → JSON backup writes it. */
const backup = {
  format: 'amplifier-backup', version: 2, exportedAt: '2026-11-01T08:00:00.000Z',
  profile: { schoolName: 'Test High', gradeLevel: 'Grade 10', section: 'A', academicYear: '2026-2027', displayName: 'Sam' },
  subjects: [subject(1, 'Science'), subject(2, 'English')],
  assessments: [
    // Science Q2: WW 26/30 = 86.667% → 86.7 with only WW recorded. English Q2: PT 40/50 → 80.
    { id: 1, subject: 'Science', component: 'ww', title: 'Quiz 1', score: 18, maxScore: 20, date: '2026-10-01', period: 'Quarter 2' },
    { id: 2, subject: 'Science', component: 'ww', title: 'Quiz 2', score: 8, maxScore: 10, date: '2026-10-02', period: 'Quarter 2' },
    { id: 3, subject: 'English', component: 'pt', title: 'Essay', score: 40, maxScore: 50, date: '2026-10-03', period: 'Quarter 2' },
    { id: 4, subject: 'English', component: 'exam', title: 'Planned test', score: 0, maxScore: 50, date: '2026-11-10', period: 'Quarter 2' },
  ],
  historicalGrades: [{ id: 10, subject: 'Science', period: 'Quarter 1', grade: 88 }, { id: 11, subject: 'English', period: 'Quarter 1', grade: 82 }],
  tasks: [
    { id: 20, title: 'Lab write-up', subject: 'Science', date: '', dueDate: '2026-11-04', kind: 'Project', done: false },
    { id: 21, title: 'Old reading', subject: 'English', date: '', dueDate: '2026-10-30', kind: 'Homework', done: false },
    { id: 22, title: 'Finished', subject: 'English', date: '', dueDate: '2026-11-05', kind: 'Homework', done: true },
  ],
  schedule: [],
  settings: { gradingWeights: { Science: { ww: 30, pt: 50, exam: 20 }, English: { ww: 30, pt: 50, exam: 20 } }, period: 'Quarter 2', targetAverage: '90', passingGrade: 75, gradingScale: 'percentage', futureGrades: {} },
};
// Only English Q2 exam is in the future, and it has a 0 score; drop it for grade tests so it doesn't pull English down.
const gradesOnly = { ...backup, assessments: backup.assessments.slice(0, 3) };

async function connect(workspace: McpWorkspace | (() => McpWorkspace)) {
  const server = createAmplifierMcpServer({ loadWorkspace: typeof workspace === 'function' ? workspace : () => workspace });
  const client = new Client({ name: 'amplifier-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text: string }[])[0].text;
    return { isError: result.isError === true, text, data: result.isError ? null : JSON.parse(text) };
  };
  return { client, call };
}

describe('backup source', () => {
  it('accepts only version 2 AMPlifier backups', () => {
    expect(() => parseBackup({ ...backup, format: 'other' })).toThrow(BackupError);
    expect(() => parseBackup({ ...backup, version: 1 })).toThrow(/version 1/);
    expect(() => parseBackupText('{nope')).toThrow(/not valid JSON/);
  });

  it('runs records through the app normalisers', () => {
    const ws = parseBackup({ ...backup, subjects: [...backup.subjects, { name: 'Science' }, { bad: true }], assessments: [...backup.assessments, { subject: 'Science', component: 'quiz', score: 1, maxScore: 2 }] });
    expect(ws.subjects.map(item => item.name)).toEqual(['Science', 'English']);
    expect(ws.assessments).toHaveLength(4);
    expect(ws.settings.period).toBe('Quarter 2');
  });
});

describe('tool registry', () => {
  it('exposes only READ and SIMULATE tools, all read-only', async () => {
    const { client } = await connect(parseBackup(backup));
    const { tools } = await client.listTools();
    expect(tools.map(tool => tool.name).sort()).toEqual(Object.keys(TOOL_PERMISSIONS).sort());
    expect(Object.values(TOOL_PERMISSIONS).every(permission => permission === 'read' || permission === 'simulate')).toBe(true);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
    }
  });
});

describe('READ tools', () => {
  const ws = parseBackup(gradesOnly);

  it('overview reports the same figures as the app model', async () => {
    const { call } = await connect(ws);
    const { data } = await call('get_academic_overview');
    const model = deriveAcademicModel(ws);
    expect(data.student).toBe('Sam');
    expect(data.currentPeriod).toBe('Quarter 2');
    expect(data.currentPeriodAverage).toBeCloseTo(model.currentAverage!, 2);
    expect(data.currentPeriodAverage).toBeCloseTo(83.35, 2);
    expect(data.yearToDateAverage).toBeCloseTo(model.yearToDate!, 2);
    expect(data.subjects).toEqual([
      { name: 'Science', currentGrade: 86.7, status: 'passing', changeFromPreviousTerm: -1.3 },
      { name: 'English', currentGrade: 80, status: 'passing', changeFromPreviousTerm: -2 },
    ]);
    expect(data.requiredAverageForTarget).toMatchObject({ status: 'ok', remainingTerms: 6 });
  });

  it('subject grades show components, term sources and goals', async () => {
    const { call } = await connect(ws);
    const { data } = await call('get_subject_grades', { subject: 'science' });
    expect(data.subject).toBe('Science');
    expect(data.currentGrade).toBe(86.7);
    expect(data.components.find((item: any) => item.component === 'ww')).toMatchObject({ weight: 30, average: 86.7, assessmentsThisPeriod: 2 });
    expect(data.components.find((item: any) => item.component === 'pt').average).toBeNull();
    expect(data.terms.slice(0, 2)).toEqual([{ period: 'Quarter 1', grade: 88, source: 'Actual' }, { period: 'Quarter 2', grade: 86.7, source: 'Estimated' }]);
    // (90 × 4 − 88) / 3 remaining terms
    expect(data.neededPerRemainingTermForTarget).toBeCloseTo(90.67, 2);
  });

  it('assessment history filters and sorts newest first', async () => {
    const { call } = await connect(ws);
    const { data } = await call('get_assessment_history', { subject: 'Science', component: 'ww' });
    expect(data.total).toBe(2);
    expect(data.assessments.map((item: any) => item.title)).toEqual(['Quiz 2', 'Quiz 1']);
    expect(data.assessments[1].percent).toBe(90);
  });

  it('upcoming work lists open tasks and future assessments, soonest first', () => {
    const result = upcomingAssessments(parseBackup(backup), {}, '2026-11-02');
    expect(result.items.map(item => [item.title, item.overdue, item.daysUntil])).toEqual([
      ['Old reading', true, -3], ['Lab write-up', false, 2], ['Planned test', false, 8],
    ]);
    expect(upcomingAssessments(parseBackup(backup), { daysAhead: 7, includeOverdue: false }, '2026-11-02').items.map(item => item.title)).toEqual(['Lab write-up']);
  });

  it('rejects unknown subjects and periods with a helpful tool error', async () => {
    const { call } = await connect(ws);
    const missing = await call('get_subject_grades', { subject: 'Latin' });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('Science, English');
    const badPeriod = await call('compare_quarters', { from: 'Semester 1' });
    expect(badPeriod.isError).toBe(true);
  });
});

describe('SIMULATE tools', () => {
  it('simulate_grade uses the engine and never changes records', async () => {
    const ws = parseBackup(gradesOnly);
    const snapshot = JSON.stringify(ws);
    const { call } = await connect(ws);
    const { data } = await call('simulate_grade', { subject: 'Science', hypotheticals: [{ component: 'exam', score: 20, maxScore: 20 }, { component: 'pt', score: 40, maxScore: 50 }] });
    // .3 × 86.667 + .5 × 80 + .2 × 100 = 86.0
    expect(data.before.grade).toBe(86.7);
    expect(data.after).toEqual({ grade: 86, ww: 86.7, pt: 80, exam: 100 });
    expect(data.gradeChange).toBeCloseTo(-0.7, 5);
    expect(data.periodAverage).toEqual({ before: 83.35, after: 83 });
    expect(JSON.stringify(ws)).toBe(snapshot);
  });

  it('get_grade_requirements returns the minimum score from requiredScore', async () => {
    const { call } = await connect(parseBackup(gradesOnly));
    const { data } = await call('get_grade_requirements', { subject: 'Science', component: 'exam', max_score: 20, target: 90 });
    expect(data.result).toMatchObject({ status: 'possible', score: 18.98 });
    expect((await call('get_grade_requirements', { subject: 'Science', component: 'exam', max_score: 20, target: 99 })).data.result).toEqual({ status: 'impossible', bestGrade: 92 });
  });

  it('forecast_general_average matches the engine scenarios and accepts custom assumptions', async () => {
    const ws = parseBackup(gradesOnly);
    const model = deriveAcademicModel(ws);
    const { call } = await connect(ws);
    const { data } = await call('forecast_general_average');
    const realistic = data.scenarios.find((item: any) => item.key === 'realistic');
    const expected = projectedGeneralAverage(applyAssumptions(model.rows, model.termPeriods, scenarioAssumptions(model.rows, model.termPeriods, model.currentIndex, 'realistic')));
    expect(realistic.projection.average).toBeCloseTo(expected.average!, 2);
    // Science: Q1 88, Q2 86.7 → realistic 87.35, stored to one decimal (87.3) for Q3/Q4. English: 82, 80 → 81.
    expect(realistic.projection.average).toBeCloseTo(((88 + 86.7 + 87.3 * 2) / 4 + 81) / 2, 2);
    expect(data.scenarios.map((item: any) => item.key)).toEqual(['conservative', 'realistic', 'optimistic']);

    const custom = (await call('forecast_general_average', { scenario: 'saved', assumptions: { Science: { 'Quarter 1': 50, 'Quarter 3': 90, 'Quarter 4': 90 } } })).data;
    expect(custom.scenarios).toEqual([]);
    // The Quarter 1 assumption is ignored because an Actual grade exists: Science (88 + 86.7 + 90 + 90) / 4, English (82 + 80) / 2.
    expect(custom.custom.projection.average).toBeCloseTo(((88 + 86.7 + 180) / 4 + 81) / 2, 2);
  });

  it('compare_quarters compares the previous and current term by default', async () => {
    const { call } = await connect(parseBackup(gradesOnly));
    const { data } = await call('compare_quarters');
    expect([data.from, data.to]).toEqual(['Quarter 1', 'Quarter 2']);
    expect(data.subjects.map((item: any) => [item.subject, item.change])).toEqual([['Science', -1.3], ['English', -2]]);
    expect(data.averageChange).toBeCloseTo(-1.65, 2);
    expect(data.mostImproved).toBeNull();
    expect(data.largestDrop).toBe('English');
  });

  it('works on the demo workspace end to end', async () => {
    const demo = JSON.parse(JSON.stringify({ format: 'amplifier-backup', version: 2, ...buildDemoWorkspace() }));
    const { call } = await connect(parseBackup(demo));
    for (const name of ['get_academic_overview', 'forecast_general_average', 'compare_quarters', 'get_upcoming_assessments', 'get_assessment_history']) {
      expect((await call(name)).isError).toBe(false);
    }
    expect(academicOverview(parseBackup(demo)).currentPeriod).toBe('Quarter 3');
  });
});

describe('per-user file source', () => {
  let dir: string;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'amplifier-mcp-')); });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('re-reads the backup on every call and never writes to it', async () => {
    const file = join(dir, 'backup.json');
    writeFileSync(file, JSON.stringify(gradesOnly));
    const { call } = await connect(() => parseBackupText(readFileSync(file, 'utf8')));
    await call('simulate_grade', { subject: 'English', hypotheticals: [{ component: 'exam', score: 50, maxScore: 50 }] });
    expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(gradesOnly));
    writeFileSync(file, JSON.stringify({ ...gradesOnly, profile: { ...gradesOnly.profile, displayName: 'Alex' } }));
    expect((await call('get_academic_overview')).data.student).toBe('Alex');
    writeFileSync(file, '{}');
    expect((await call('get_academic_overview')).text).toMatch(/Not an AMPlifier backup/);
  });
});

describe('bundle boundary', () => {
  it('no app module imports the MCP server or SDK', () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? (name === 'mcp' || name === '__tests__' ? [] : files(path)) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
    const offenders = files(root).filter(path => /from ['"](@modelcontextprotocol|zod|[./]+\/mcp\/)/.test(readFileSync(path, 'utf8')));
    expect(offenders.map(path => relative(root, path))).toEqual([]);
  });
});
