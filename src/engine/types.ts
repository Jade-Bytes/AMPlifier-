export type GradingComponent = 'WW' | 'PT' | 'QA';

export type GradingPeriod = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface ComponentWeight {
  ww: number; // Written Works percentage (e.g., 0.40 or 40)
  pt: number; // Performance Tasks percentage (e.g., 0.40 or 40)
  qa: number; // Quarterly Assessment/Exam percentage (e.g., 0.20 or 20)
}

export interface Assessment {
  id: string;
  subjectId: string;
  quarter: GradingPeriod;
  component: GradingComponent;
  title: string;
  score: number;
  totalPossible: number;
  date?: string;
  weightMultiplier?: number; // Default 1
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  color?: string;
  weights: ComponentWeight;
  units?: number; // Weight in General Average, default 1.0
  useTransmutation: boolean;
}

export interface GradingTemplate {
  id: string;
  name: string;
  description: string;
  subjects: Array<{
    name: string;
    code?: string;
    color: string;
    weights: ComponentWeight;
    units: number;
    useTransmutation: boolean;
  }>;
}

export interface ComponentResult {
  totalScore: number;
  totalPossible: number;
  percentageScore: number; // 0 - 100
  weightedScore: number;
  count: number;
  hasAssessments: boolean;
}

export interface QuarterlySubjectResult {
  subjectId: string;
  subjectName: string;
  quarter: GradingPeriod;
  writtenWorks: ComponentResult;
  performanceTasks: ComponentResult;
  quarterlyAssessment: ComponentResult;
  initialGrade: number; // Raw combined weighted score (0 - 100)
  quarterlyGrade: number; // Transmuted or final grade (60 - 100 or raw)
  isProvisional: boolean; // True if some components have no scores yet
  completionRatio: number; // Fraction of components populated (0.0 to 1.0)
}

export interface AnnualSubjectResult {
  subjectId: string;
  subjectName: string;
  quarters: Record<GradingPeriod, QuarterlySubjectResult | null>;
  actualFinalGrade: number | null; // Average of completed quarters if all 4 are done
  projectedFinalGrade: number; // Blend of completed quarters + assumed/projected future quarters
}

export interface AcademicWeakness {
  id: string;
  subjectId: string;
  subjectName: string;
  type: 'declining' | 'inconsistent' | 'low_component' | 'critical_impact';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestedAction: string;
}

export interface EstimatedReportCard {
  subjects: AnnualSubjectResult[];
  quarterlyAverages: Record<GradingPeriod, number | null>;
  currentGeneralAverage: number | null; // Computed only from quarters completed so far
  projectedGeneralAverage: number; // Projected final general average using future assumptions
  futureAssumptions: Record<string, Partial<Record<GradingPeriod, number>>>; // subjectId -> quarter -> assumed grade
  weaknesses: AcademicWeakness[];
}
