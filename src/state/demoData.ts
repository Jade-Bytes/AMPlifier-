import { normalizeSubjectWeights } from '../engine/calculator';
import { todayISO } from '../lib/dates';
import { normalizeSettings, type WorkspaceSettings } from '../lib/records';
import type { AcademicProfile, Assessment, ClassSession, GradeComponent, HistoricalGrade, Subject, Task } from '../types/app';

/** Fictional sample workspace for the developer preview. Nothing here is ever written to Firestore. */
export function buildDemoWorkspace(): { profile: AcademicProfile; subjects: Subject[]; assessments: Assessment[]; historicalGrades: HistoricalGrade[]; tasks: Task[]; schedule: ClassSession[]; settings: WorkspaceSettings } {
  const names: [string, string, string][] = [
    ['Mathematics', 'MATH', '#4f76e8'], ['Science', 'SCI', '#5f9466'], ['English', 'ENG', '#d38a59'], ['Filipino', 'FIL', '#9a72c4'],
    ['Araling Panlipunan', 'AP', '#c9a23a'], ['MAPEH', 'MAPEH', '#4f9f98'], ['Values Education', 'VE', '#d4687a'],
  ];
  const subjects: Subject[] = names.map(([name, code, color], index) => ({ id: index + 1, name, code, color, grade: 0, change: 0, ww: 0, pt: 0, exam: 0, hasBaseline: false }));
  const rows: [string, string, GradeComponent, number, number, string][] = [
    ['Mathematics', 'Problem set 1', 'ww', 18, 20, '2026-10-05'], ['Mathematics', 'Geometry project', 'pt', 42, 50, '2026-10-12'], ['Mathematics', 'Unit test', 'exam', 31, 40, '2026-10-20'], ['Mathematics', 'Seatwork 4', 'ww', 9, 15, '2026-10-27'],
    ['Science', 'Lab report', 'pt', 46, 50, '2026-10-06'], ['Science', 'Chapter quiz', 'ww', 18, 20, '2026-10-14'], ['Science', 'Unit test', 'exam', 36, 40, '2026-10-22'],
    ['English', 'Reading response', 'ww', 19, 20, '2026-10-07'], ['English', 'Oral presentation', 'pt', 44, 50, '2026-10-16'], ['English', 'Grammar quiz', 'exam', 16, 20, '2026-10-24'],
    ['Filipino', 'Talasalitaan', 'ww', 17, 20, '2026-10-08'], ['Filipino', 'Pangkatang gawain', 'pt', 45, 50, '2026-10-17'], ['Filipino', 'Pagsusulit', 'exam', 18, 20, '2026-10-25'],
    ['Araling Panlipunan', 'Source analysis', 'ww', 13, 20, '2026-10-09'], ['Araling Panlipunan', 'History project', 'pt', 37, 50, '2026-10-18'], ['Araling Panlipunan', 'Unit quiz', 'exam', 14, 20, '2026-10-26'],
    ['MAPEH', 'Dance performance', 'pt', 49, 50, '2026-10-10'], ['MAPEH', 'Written reflection', 'ww', 19, 20, '2026-10-19'], ['MAPEH', 'Health quiz', 'exam', 18, 20, '2026-10-27'],
    ['Values Education', 'Reflection journal', 'ww', 18, 20, '2026-10-11'], ['Values Education', 'Group activity', 'pt', 46, 50, '2026-10-21'], ['Values Education', 'Short quiz', 'exam', 17, 20, '2026-10-28'],
  ];
  const assessments: Assessment[] = rows.map(([subject, title, component, score, maxScore, date], index) => ({ id: 9100 + index, subject, title, component, score, maxScore, date, period: 'Quarter 3' }));
  const q1 = [86, 89, 91, 88, 84, 92, 90];
  const q2 = [88, 90, 90, 89, 82, 93, 91];
  const historicalGrades: HistoricalGrade[] = subjects.flatMap((subject, index) => [
    { id: 9200 + index, subject: subject.name, period: 'Quarter 1', grade: q1[index] },
    { id: 9300 + index, subject: subject.name, period: 'Quarter 2', grade: q2[index] },
  ]);
  const inDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return todayISO(date); };
  const tasks: Task[] = [
    { id: 9401, title: 'Geometry problem set', subject: 'Mathematics', date: '', dueDate: inDays(1), kind: 'Homework', done: false, priority: 'high' },
    { id: 9402, title: 'Ecosystem model', subject: 'Science', date: '', dueDate: inDays(4), kind: 'Project', done: false, priority: 'normal' },
    { id: 9403, title: 'Reading journal', subject: 'English', date: '', dueDate: inDays(9), kind: 'Assignment', done: false, priority: 'low' },
    { id: 9404, title: 'Timeline of the revolution', subject: 'Araling Panlipunan', date: '', dueDate: inDays(-1), kind: 'Assignment', done: false, priority: 'high' },
    { id: 9405, title: 'MAPEH reflection', subject: 'MAPEH', date: '', dueDate: inDays(-3), kind: 'Homework', done: true, priority: 'normal' },
  ];
  const schedule: ClassSession[] = [
    { id: 9501, subject: 'Mathematics', dayOfWeek: 1, startTime: '08:00', endTime: '09:00', room: 'Room 204' },
    { id: 9502, subject: 'Science', dayOfWeek: 2, startTime: '09:30', endTime: '10:30', room: 'Science Lab' },
    { id: 9503, subject: 'English', dayOfWeek: 3, startTime: '08:00', endTime: '09:00' },
    { id: 9504, subject: 'MAPEH', dayOfWeek: 4, startTime: '13:00', endTime: '14:00', room: 'Gym' },
  ];
  const settings = normalizeSettings({
    gradingWeights: normalizeSubjectWeights({}, subjects),
    period: 'Quarter 3',
    targetAverage: '90',
    futureGrades: Object.fromEntries(subjects.map((subject, index) => [subject.name, { 'Quarter 4': String([90, 91, 92, 90, 86, 94, 93][index]) }])),
  }, subjects);
  return {
    profile: { schoolName: 'Demo Academy', gradeLevel: 'Grade 9', section: 'Sample Section', academicYear: '2026-2027', displayName: 'Demo Student', username: 'demo_student' },
    subjects, assessments, historicalGrades, tasks, schedule, settings,
  };
}
