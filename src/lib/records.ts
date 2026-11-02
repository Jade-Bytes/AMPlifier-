import { componentFromLabel, normalizeSubjectWeights } from '../engine/calculator';
import type { Assessment, ClassSession, FutureGrades, GradingScale, HistoricalGrade, Subject, SubjectGradingWeights, Task, TaskPriority } from '../types/app';
import { isISODate, toISODate } from './dates';

/* Normalisers guard against malformed or legacy records coming from Firestore or the local cache. */

let fallbackId = Date.now();
const idOr = (value: unknown) => Number(value) || ++fallbackId;

export function normalizeAssessments(raw: unknown): Assessment[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: any) => {
    const component = componentFromLabel(item?.component);
    const score = Number(item?.score);
    const maxScore = Number(item?.maxScore);
    if (!component || typeof item?.subject !== 'string' || !Number.isFinite(score) || !Number.isFinite(maxScore)) return [];
    return [{ id: idOr(item.id), subject: item.subject, component, title: typeof item.title === 'string' ? item.title : 'Assessment', score, maxScore, date: typeof item.date === 'string' ? item.date : '', period: typeof item.period === 'string' ? item.period : 'Quarter 1' }];
  });
}

export function normalizeHistoricalGrades(raw: unknown): HistoricalGrade[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: any) => {
    const grade = Number(item?.grade);
    if (typeof item?.subject !== 'string' || typeof item?.period !== 'string' || !Number.isFinite(grade) || grade < 0 || grade > 100) return [];
    return [{ id: idOr(item.id), subject: item.subject, period: item.period, grade }];
  });
}

/** Monday = 1 … Saturday = 6. */
export function normalizeSchedule(raw: unknown): ClassSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: any) => {
    const day = Number(item?.dayOfWeek);
    if (typeof item?.subject !== 'string' || !Number.isInteger(day) || day < 1 || day > 6 || !/^\d{2}:\d{2}$/.test(item?.startTime) || !/^\d{2}:\d{2}$/.test(item?.endTime)) return [];
    return [{ id: idOr(item.id), subject: item.subject, dayOfWeek: day, startTime: item.startTime, endTime: item.endTime, room: typeof item.room === 'string' ? item.room : '', teacher: typeof item.teacher === 'string' ? item.teacher : '' }];
  });
}

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high'];

export function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: any) => {
    if (typeof item?.title !== 'string') return [];
    const dueDate = isISODate(item.dueDate) ? item.dueDate : typeof item.date === 'string' && item.date ? toISODate(item.date) : undefined;
    return [{
      id: idOr(item.id), title: item.title, subject: typeof item.subject === 'string' ? item.subject : '',
      date: typeof item.date === 'string' ? item.date : '', ...(dueDate ? { dueDate } : {}),
      kind: typeof item.kind === 'string' ? item.kind : 'Homework', done: item.done === true,
      priority: PRIORITIES.includes(item.priority) ? item.priority : 'normal',
      ...(typeof item.notes === 'string' && item.notes ? { notes: item.notes } : {}),
    }];
  });
}

export function normalizeFutureGrades(raw: unknown): FutureGrades {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([subject, periods]) => [subject,
    periods && typeof periods === 'object' && !Array.isArray(periods)
      ? Object.fromEntries(Object.entries(periods as Record<string, unknown>).map(([period, value]) => [period, String(value ?? '')]))
      : {},
  ]));
}

export type WorkspaceSettings = {
  gradingWeights: SubjectGradingWeights;
  period: string;
  futureGrades: FutureGrades;
  targetAverage: string;
  passingGrade: number;
  gradingScale: GradingScale;
};

export const DEFAULT_PASSING_GRADE = 75;

export function normalizeSettings(raw: Record<string, unknown> | undefined, subjects: Pick<Subject, 'name'>[]): WorkspaceSettings {
  const settings = raw ?? {};
  const passing = Number(settings.passingGrade);
  return {
    gradingWeights: normalizeSubjectWeights(settings.gradingWeights, subjects),
    period: typeof settings.period === 'string' ? settings.period : 'Quarter 1',
    futureGrades: normalizeFutureGrades(settings.futureGrades),
    targetAverage: typeof settings.targetAverage === 'string' ? settings.targetAverage : '',
    passingGrade: Number.isFinite(passing) && passing > 0 && passing <= 100 ? passing : DEFAULT_PASSING_GRADE,
    gradingScale: settings.gradingScale === 'deped' ? 'deped' : 'percentage',
  };
}

/* Subjects are referenced by name across every record type. These helpers keep them consistent. */

export type SubjectLinkedData = {
  assessments: Assessment[];
  historicalGrades: HistoricalGrade[];
  tasks: Task[];
  schedule: ClassSession[];
  gradingWeights: SubjectGradingWeights;
  futureGrades: FutureGrades;
};

function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  if (!(from in record)) return record;
  const { [from]: value, ...rest } = record;
  return { ...rest, [to]: value };
}

export function renameSubjectInData(data: SubjectLinkedData, from: string, to: string): SubjectLinkedData {
  const swap = <T extends { subject: string }>(items: T[]) => items.map(item => item.subject === from ? { ...item, subject: to } : item);
  return {
    assessments: swap(data.assessments),
    historicalGrades: swap(data.historicalGrades),
    tasks: swap(data.tasks),
    schedule: swap(data.schedule),
    gradingWeights: renameKey(data.gradingWeights, from, to),
    futureGrades: renameKey(data.futureGrades, from, to),
  };
}

/** Removes a subject's grade records and timetable entries. Tasks are kept but detached from the subject. */
export function removeSubjectFromData(data: SubjectLinkedData, name: string): SubjectLinkedData {
  const { [name]: _weights, ...gradingWeights } = data.gradingWeights;
  const { [name]: _future, ...futureGrades } = data.futureGrades;
  return {
    assessments: data.assessments.filter(item => item.subject !== name),
    historicalGrades: data.historicalGrades.filter(item => item.subject !== name),
    tasks: data.tasks.map(item => item.subject === name ? { ...item, subject: '' } : item),
    schedule: data.schedule.filter(item => item.subject !== name),
    gradingWeights,
    futureGrades,
  };
}

export const SUBJECT_COLORS = ['#4f76e8', '#5f9466', '#d38a59', '#9a72c4', '#d4687a', '#c9a23a', '#4f9f98', '#667b8f', '#b5694d', '#6a83b8'];

export function subjectCode(name: string): string {
  return name.trim().split(/\s+/).map(word => word.slice(0, 1)).join('').slice(0, 5).toUpperCase() || name.slice(0, 3).toUpperCase();
}
