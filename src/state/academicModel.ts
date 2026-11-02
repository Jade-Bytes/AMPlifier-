import { calculateAverage, recalculateSubjects } from '../engine/calculator';
import { academicInsights } from '../engine/insights';
import { termPeriodsFor } from '../engine/periods';
import { buildReportCard, gradeTrend, parseGradeInput, projectedGeneralAverage, requiredOverallAverage, subjectChange, subjectGoals, yearToDateAverage, type ReportContext } from '../engine/reportCard';
import { daysUntil, toISODate, todayISO } from '../lib/dates';
import type { WorkspaceSettings } from '../lib/records';
import type { Assessment, HistoricalGrade, Subject, Task } from '../types/app';

export type UpcomingItem = { id: string; title: string; subject: string; kind: string; date: string; source: 'Task' | 'Assessment'; overdue: boolean };

/** The records every derived academic figure depends on. */
export type AcademicInputs = {
  subjects: Subject[];
  assessments: Assessment[];
  historicalGrades: HistoricalGrade[];
  tasks: Task[];
  settings: WorkspaceSettings;
};

/**
 * All derived academic figures as a pure function of the records. Shared by the React app
 * (`useAcademicModel`) and the MCP server so both always report the same numbers.
 */
export function deriveAcademicModel({ subjects: baseSubjects, assessments, historicalGrades, tasks, settings }: AcademicInputs, today = todayISO()) {
  const period = settings.period;
  const options = { scale: settings.gradingScale };
  const weights = settings.gradingWeights;
  const termPeriods = termPeriodsFor(period);
  const currentIndex = Math.max(0, termPeriods.indexOf(period));
  const current = recalculateSubjects(baseSubjects, assessments, weights, period, options);
  const graded = current.filter(subject => subject.hasGrades);
  const context: ReportContext = { subjects: baseSubjects, assessments, historicalGrades, weights, futureGrades: settings.futureGrades, options };
  const rows = buildReportCard(context, termPeriods);
  const changes = Object.fromEntries(rows.map(row => [row.subject.name, subjectChange(row, currentIndex)]));
  const target = parseGradeInput(settings.targetAverage);
  const upcoming: UpcomingItem[] = [
    ...tasks.filter(task => !task.done).map(task => {
      const date = task.dueDate ?? toISODate(task.date);
      return { id: `task-${task.id}`, title: task.title, subject: task.subject, kind: task.kind, date, source: 'Task' as const, overdue: daysUntil(date, today) < 0 };
    }),
    // Assessments dated after today are planned ones; today's are already-recorded results.
    ...assessments.filter(item => item.date > today).map(item => ({ id: `assessment-${item.id}`, title: item.title, subject: item.subject, kind: 'Assessment', date: toISODate(item.date), source: 'Assessment' as const, overdue: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    period, options, weights, termPeriods, currentIndex, target, rows, changes,
    /** Subjects with grade fields calculated for the current period. */
    current,
    graded,
    currentAverage: graded.length ? calculateAverage(graded) : null,
    yearToDate: yearToDateAverage(rows, currentIndex),
    projection: projectedGeneralAverage(rows),
    required: requiredOverallAverage(rows, target, currentIndex),
    goals: subjectGoals(rows, target, currentIndex),
    trend: gradeTrend(rows, termPeriods),
    insights: academicInsights({ subjects: current, assessments, period, passingGrade: settings.passingGrade, changes }),
    hasAnyGradeData: graded.length > 0 || historicalGrades.length > 0,
    upcoming,
    overdueCount: upcoming.filter(item => item.overdue).length,
    dueSoonCount: upcoming.filter(item => !item.overdue && daysUntil(item.date, today) <= 7).length,
  };
}

export type AcademicModel = ReturnType<typeof deriveAcademicModel>;
