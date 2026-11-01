import { Assessment, GradingPeriod, Subject } from '../engine/types';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface SchoolConfig {
  schoolName: string;
  gradeLevel: string;
  section: string;
  academicYear: string;
  templateId: string;
  activeQuarter: GradingPeriod;
}

export interface AcademicTask {
  id: string;
  subjectId: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  type: 'Quiz' | 'Exam' | 'PerformanceTask' | 'Assignment' | 'Project';
}

export interface StudySession {
  id: string;
  subjectId: string;
  durationMinutes: number;
  date: string;
  notes?: string;
}

export interface AppSettings {
  darkMode: boolean;
  enableTransmutation: boolean;
  googleDriveSyncEnabled: boolean;
  lastBackupDate?: string;
}

export interface AppData {
  version: string;
  user: UserProfile;
  school: SchoolConfig;
  subjects: Subject[];
  assessments: Assessment[];
  tasks: AcademicTask[];
  studySessions: StudySession[];
  futureAssumptions: Record<string, Partial<Record<GradingPeriod, number>>>;
  settings: AppSettings;
}
