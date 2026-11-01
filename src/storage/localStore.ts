import { AppData } from '../types/app';
import { DEFAULT_DEPED_TEMPLATE } from '../engine/templates';
import { Subject, Assessment } from '../engine/types';

const STORAGE_KEY = 'amplifier_academic_data_v1';

export function createInitialData(): AppData {
  const subjects: Subject[] = DEFAULT_DEPED_TEMPLATE.subjects.map((s, idx) => ({
    ...s,
    id: `subj_${idx + 1}`,
  }));

  // Initial starter assessments so the dashboard immediately showcases calculations
  const starterAssessments: Assessment[] = [
    { id: 'a1', subjectId: 'subj_1', quarter: 'Q1', component: 'WW', title: 'Pagsusulit 1', score: 18, totalPossible: 20 },
    { id: 'a2', subjectId: 'subj_1', quarter: 'Q1', component: 'PT', title: 'Talumpati', score: 92, totalPossible: 100 },
    { id: 'a3', subjectId: 'subj_2', quarter: 'Q1', component: 'WW', title: 'Grammar Quiz', score: 23, totalPossible: 25 },
    { id: 'a4', subjectId: 'subj_2', quarter: 'Q1', component: 'PT', title: 'Essay Writing', score: 88, totalPossible: 100 },
    { id: 'a5', subjectId: 'subj_3', quarter: 'Q1', component: 'WW', title: 'Periodic Table Quiz', score: 19, totalPossible: 20 },
    { id: 'a6', subjectId: 'subj_3', quarter: 'Q1', component: 'PT', title: 'Lab Experiment', score: 95, totalPossible: 100 },
    { id: 'a7', subjectId: 'subj_4', quarter: 'Q1', component: 'WW', title: 'Module 1 Activity', score: 19, totalPossible: 20 },
    { id: 'a8', subjectId: 'subj_5', quarter: 'Q1', component: 'WW', title: 'Kasaysayan Quiz', score: 27, totalPossible: 30 },
    { id: 'a9', subjectId: 'subj_6', quarter: 'Q1', component: 'PT', title: 'Technical Drawing', score: 94, totalPossible: 100 },
    { id: 'a10', subjectId: 'subj_7', quarter: 'Q1', component: 'PT', title: 'HTML Coding Project', score: 98, totalPossible: 100 },
    { id: 'a11', subjectId: 'subj_8', quarter: 'Q1', component: 'PT', title: 'Folk Dance Performance', score: 90, totalPossible: 100 },
  ];

  return {
    version: '1.0.0',
    user: {
      id: 'usr_default',
      name: 'Scholar Student',
      email: 'student@amplifier.local',
    },
    school: {
      schoolName: 'Science & Technology High School',
      gradeLevel: 'Grade 10',
      section: 'Einstein',
      academicYear: '2026-2027',
      templateId: 'deped_junior_high',
      activeQuarter: 'Q1',
    },
    subjects,
    assessments: starterAssessments,
    tasks: [
      {
        id: 't1',
        subjectId: 'subj_3',
        title: 'Science First Quarter Examination',
        dueDate: '2026-11-15',
        priority: 'high',
        isCompleted: false,
        type: 'Exam',
        description: 'Covers Module 1 to 4: Genetics and Evolution.',
      },
      {
        id: 't2',
        subjectId: 'subj_7',
        title: 'Computer Programming Seatwork',
        dueDate: '2026-11-08',
        priority: 'medium',
        isCompleted: false,
        type: 'PerformanceTask',
      },
    ],
    studySessions: [],
    futureAssumptions: {},
    settings: {
      darkMode: false,
      enableTransmutation: true,
      googleDriveSyncEnabled: false,
    },
  };
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialData();
      saveAppData(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as AppData;
    return parsed;
  } catch (err) {
    console.error('Failed to load application data from localStorage:', err);
    return createInitialData();
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save application data to localStorage:', err);
  }
}

export function exportBackupJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function importBackupJSON(jsonString: string): AppData {
  const parsed = JSON.parse(jsonString) as AppData;
  if (!parsed.subjects || !Array.isArray(parsed.subjects)) {
    throw new Error('Invalid backup file: missing subjects definition.');
  }
  if (!parsed.assessments || !Array.isArray(parsed.assessments)) {
    throw new Error('Invalid backup file: missing assessments.');
  }
  saveAppData(parsed);
  return parsed;
}
