import { CalendarDays, ClipboardList, FileText, FlaskConical, GraduationCap, LayoutDashboard, ListTodo, Settings2, TrendingUp, Users, type LucideIcon } from 'lucide-react';

export type PageId = 'overview' | 'grades' | 'report' | 'simulator' | 'forecast' | 'notes' | 'schedule' | 'tasks' | 'community' | 'settings';

export type NavItem = { id: PageId; label: string; icon: LucideIcon; description: string };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Academics', items: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Where you stand right now.' },
    { id: 'grades', label: 'Gradebook', icon: GraduationCap, description: 'Record scores and report-card grades, subject by subject.' },
    { id: 'report', label: 'Report card', icon: ClipboardList, description: 'Term-by-term grades with actual, estimated, and projected values labeled.' },
    { id: 'simulator', label: 'Simulator', icon: FlaskConical, description: 'Try hypothetical scores. Nothing here changes your records.' },
    { id: 'forecast', label: 'Forecast', icon: TrendingUp, description: 'Project your final general average and plan toward a target.' },
  ] },
  { label: 'Organize', items: [
    { id: 'tasks', label: 'Tasks', icon: ListTodo, description: 'Assignments, projects, and deadlines in one list.' },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays, description: 'Your weekly timetable and what is due this week.' },
    { id: 'notes', label: 'Notes', icon: FileText, description: 'Class notes organized by subject, period, and academic year.' },
  ] },
  { label: 'People', items: [
    { id: 'community', label: 'Community', icon: Users, description: 'Find classmates, chat privately, and make study groups.' },
  ] },
];

export const SETTINGS_ITEM: NavItem = { id: 'settings', label: 'Settings', icon: Settings2, description: 'School details, subjects, grading rules, and your data.' };

export const ALL_PAGES: NavItem[] = [...NAV_GROUPS.flatMap(group => group.items), SETTINGS_ITEM];

export const pageInfo = (id: PageId) => ALL_PAGES.find(item => item.id === id)!;

export const TOUR_STEPS: { page: PageId; title: string; body: string }[] = [
  { page: 'overview', title: 'Your academic overview', body: 'Your current average, year-to-date standing, projected final average, insights, and what is due — at a glance.' },
  { page: 'grades', title: 'Record your grades', body: 'Add each quiz, task, or exam to the gradebook. Enter official report-card grades for finished terms in the report-card grid.' },
  { page: 'report', title: 'Review your report card', body: 'Every term grade is labeled Actual, Estimated, or Projected so you always know which numbers are official. Print or save it as a PDF.' },
  { page: 'simulator', title: 'Try what-if scores', body: 'Stack hypothetical scores, or ask what score you need on the next assessment to reach a target. Your real records never change.' },
  { page: 'forecast', title: 'Plan toward a target', body: 'Set a final average target, compare conservative, realistic, and optimistic scenarios, and see the grade to aim for in each subject.' },
  { page: 'tasks', title: 'Stay on top of deadlines', body: 'Track assignments with due dates and priorities. Overdue work is flagged on your overview.' },
  { page: 'schedule', title: 'Build your weekly timetable', body: 'Add recurring classes. The week view also lists assessments and deadlines coming up.' },
  { page: 'notes', title: 'Keep class notes together', body: 'Write notes or import text, Markdown, CSV, PDF, and Word files, filed by subject, period, and academic year.' },
  { page: 'settings', title: 'Make it match your school', body: 'Edit school details, add or rename subjects, set each subject’s weights, the passing grade, and optional DepEd transmutation.' },
];
