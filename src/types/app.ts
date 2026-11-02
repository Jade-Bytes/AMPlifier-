export type GradeComponent = 'ww' | 'pt' | 'exam';

export type Subject = {
  id: number;
  name: string;
  code: string;
  color: string;
  grade: number;
  change: number;
  ww: number;
  pt: number;
  exam: number;
  hasBaseline?: boolean;
  hasGrades?: boolean;
  wwHasGrades?: boolean;
  ptHasGrades?: boolean;
  examHasGrades?: boolean;
};

export type AcademicProfile = {
  schoolName: string;
  gradeLevel: string;
  section: string;
  academicYear: string;
  displayName?: string;
  username?: string;
  startingFresh?: boolean;
};

export type SetupSubject = {
  name: string;
  weights: GradingWeights;
};

export type AcademicSetup = {
  profile: AcademicProfile;
  subjects: SetupSubject[];
  period: string;
};

export type TaskPriority = 'low' | 'normal' | 'high';

export type Task = {
  id: number;
  title: string;
  subject: string;
  /** Legacy display label (e.g. "Nov 06"). Kept for older records; `dueDate` is authoritative. */
  date: string;
  /** ISO date (YYYY-MM-DD). */
  dueDate?: string;
  kind: string;
  done: boolean;
  priority?: TaskPriority;
  notes?: string;
};

export type ClassSession = {
  id: number;
  subject: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  teacher?: string;
};

export type AcademicNote = {
  id: string;
  title: string;
  subject: string;
  period: string;
  academicYear: string;
  content: string;
  fileName?: string;
  fileType?: string;
  fileData?: string;
  driveFileId?: string;
  createdAt: number;
  updatedAt: number;
};

export type Assessment = {
  id: number;
  subject: string;
  component: GradeComponent;
  title: string;
  score: number;
  maxScore: number;
  date: string;
  period: string;
};

export type HistoricalGrade = {
  id: number;
  subject: string;
  period: string;
  grade: number;
};

export type GradingWeights = Record<GradeComponent, number>;
export type SubjectGradingWeights = Record<string, GradingWeights>;

/**
 * How a term grade is derived from weighted component scores.
 * - `percentage`: the weighted percentage itself (original AMPlifier behaviour).
 * - `deped`: the weighted "initial grade" is transmuted with the DepEd Order No. 8, s. 2015 table.
 */
export type GradingScale = 'percentage' | 'deped';

export type GradeOptions = { scale?: GradingScale };

/** Where a term grade came from. Actual = official report-card entry; Estimated = calculated from
 * recorded assessments; Projected = a user assumption for a term that has no data yet. */
export type GradeSource = 'Actual' | 'Estimated' | 'Projected';

export type TermGrade = { grade: number; source: GradeSource };

/** Future-term assumptions keyed by subject name, then period. Values are raw input strings. */
export type FutureGrades = Record<string, Record<string, string>>;
