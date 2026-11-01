import {
  Assessment,
  EstimatedReportCard,
  GradingComponent,
  GradingPeriod,
  Subject,
} from './types';
import { calculateEstimatedReportCard, calculateQuarterlySubject } from './calculator';
import { getMinimumInitialGradeForTransmuted } from './transmutation';

export interface SimulationResult {
  beforeReportCard: EstimatedReportCard;
  afterReportCard: EstimatedReportCard;
  subjectId: string;
  quarter: GradingPeriod;
  subjectGradeBefore: number;
  subjectGradeAfter: number;
  subjectGradeDelta: number;
  generalAverageBefore: number;
  generalAverageAfter: number;
  generalAverageDelta: number;
  hypotheticalAssessmentsAdded: Assessment[];
}

export interface TargetScoreRequirement {
  subjectId: string;
  subjectName: string;
  quarter: GradingPeriod;
  component: GradingComponent;
  targetQuarterlyGrade: number;
  targetInitialGrade: number;
  assessmentTotalPossible: number;
  requiredScore: number;
  requiredPercentage: number;
  isPossible: boolean;
  status: 'achievable' | 'impossible_too_high' | 'already_achieved';
  message: string;
}

/**
 * Runs a what-if simulation by temporarily adding hypothetical assessments
 * and returning the exact before/after comparison without altering saved data.
 */
export function simulateAssessments(
  subjects: Subject[],
  actualAssessments: Assessment[],
  hypotheticalAssessments: Assessment[],
  futureAssumptions: Record<string, Partial<Record<GradingPeriod, number>>> = {}
): SimulationResult {
  const beforeReportCard = calculateEstimatedReportCard(
    subjects,
    actualAssessments,
    futureAssumptions
  );

  const combinedAssessments = [...actualAssessments, ...hypotheticalAssessments];

  const afterReportCard = calculateEstimatedReportCard(
    subjects,
    combinedAssessments,
    futureAssumptions
  );

  // If at least one hypothetical was added, focus diff on that subject
  const firstHypo = hypotheticalAssessments[0];
  const targetSubjectId = firstHypo ? firstHypo.subjectId : subjects[0].id;
  const targetQuarter = firstHypo ? firstHypo.quarter : 'Q1';

  const subBefore = beforeReportCard.subjects.find((s) => s.subjectId === targetSubjectId);
  const subAfter = afterReportCard.subjects.find((s) => s.subjectId === targetSubjectId);

  const gradeBefore = subBefore?.quarters[targetQuarter]?.quarterlyGrade ?? 0;
  const gradeAfter = subAfter?.quarters[targetQuarter]?.quarterlyGrade ?? 0;

  const gaBefore = beforeReportCard.projectedGeneralAverage;
  const gaAfter = afterReportCard.projectedGeneralAverage;

  return {
    beforeReportCard,
    afterReportCard,
    subjectId: targetSubjectId,
    quarter: targetQuarter,
    subjectGradeBefore: gradeBefore,
    subjectGradeAfter: gradeAfter,
    subjectGradeDelta: Math.round((gradeAfter - gradeBefore) * 100) / 100,
    generalAverageBefore: gaBefore,
    generalAverageAfter: gaAfter,
    generalAverageDelta: Math.round((gaAfter - gaBefore) * 100) / 100,
    hypotheticalAssessmentsAdded: hypotheticalAssessments,
  };
}

/**
 * Calculates the exact score a student must achieve on an upcoming assessment
 * to reach a desired target quarterly grade in a subject.
 */
export function calculateRequiredScore(
  subject: Subject,
  quarter: GradingPeriod,
  component: GradingComponent,
  targetQuarterlyGrade: number,
  currentAssessments: Assessment[],
  upcomingAssessmentTotal: number
): TargetScoreRequirement {
  const currentQResult = calculateQuarterlySubject(subject, quarter, currentAssessments);

  // Determine needed initial grade
  const targetInitialGrade = subject.useTransmutation
    ? getMinimumInitialGradeForTransmuted(targetQuarterlyGrade)
    : targetQuarterlyGrade;

  // If already at or above target without the new assessment
  if (currentQResult.quarterlyGrade >= targetQuarterlyGrade && currentQResult.completionRatio === 1) {
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      quarter,
      component,
      targetQuarterlyGrade,
      targetInitialGrade,
      assessmentTotalPossible: upcomingAssessmentTotal,
      requiredScore: 0,
      requiredPercentage: 0,
      isPossible: true,
      status: 'already_achieved',
      message: `You have already achieved a grade of ${currentQResult.quarterlyGrade} in ${subject.name} for ${quarter}.`,
    };
  }

  // Component weights
  const { ww: weightWW, pt: weightPT, qa: weightQA } = subject.weights;
  let targetComponentWeight = 0;
  if (component === 'WW') targetComponentWeight = weightWW;
  if (component === 'PT') targetComponentWeight = weightPT;
  if (component === 'QA') targetComponentWeight = weightQA;

  // Un-normalized raw weighted points already secured by OTHER components
  let otherWeightedScore = 0;
  if (component !== 'WW' && currentQResult.writtenWorks.hasAssessments) {
    otherWeightedScore += (currentQResult.writtenWorks.percentageScore * weightWW);
  }
  if (component !== 'PT' && currentQResult.performanceTasks.hasAssessments) {
    otherWeightedScore += (currentQResult.performanceTasks.percentageScore * weightPT);
  }
  if (component !== 'QA' && currentQResult.quarterlyAssessment.hasAssessments) {
    otherWeightedScore += (currentQResult.quarterlyAssessment.percentageScore * weightQA);
  }

  // Target weighted score required from this component
  const requiredComponentWeightedScore = targetInitialGrade - otherWeightedScore;
  const requiredComponentPercentage = requiredComponentWeightedScore / targetComponentWeight;

  // Now within this component:
  // (currentScoreSum + requiredScore) / (currentPossibleSum + upcomingAssessmentTotal) * 100 = requiredComponentPercentage
  const compResult =
    component === 'WW'
      ? currentQResult.writtenWorks
      : component === 'PT'
      ? currentQResult.performanceTasks
      : currentQResult.quarterlyAssessment;

  const currentSumScore = compResult.totalScore;
  const currentSumPossible = compResult.totalPossible;
  const newTotalPossible = currentSumPossible + upcomingAssessmentTotal;

  // newScore / newTotalPossible = requiredComponentPercentage / 100
  const requiredNewSumScore = (requiredComponentPercentage / 100) * newTotalPossible;
  let neededAssessmentScore = requiredNewSumScore - currentSumScore;

  // Round to 1 decimal place
  neededAssessmentScore = Math.round(neededAssessmentScore * 10) / 10;
  const requiredPercentage = Math.round((neededAssessmentScore / upcomingAssessmentTotal) * 1000) / 10;

  if (neededAssessmentScore > upcomingAssessmentTotal) {
    return {
      subjectId: subject.id,
      subjectName: subject.name,
      quarter,
      component,
      targetQuarterlyGrade,
      targetInitialGrade,
      assessmentTotalPossible: upcomingAssessmentTotal,
      requiredScore: neededAssessmentScore,
      requiredPercentage,
      isPossible: false,
      status: 'impossible_too_high',
      message: `Mathematically unattainable with this assessment alone: requires ${neededAssessmentScore}/${upcomingAssessmentTotal} (${requiredPercentage}%).`,
    };
  }

  const safeScore = Math.max(0, neededAssessmentScore);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    quarter,
    component,
    targetQuarterlyGrade,
    targetInitialGrade,
    assessmentTotalPossible: upcomingAssessmentTotal,
    requiredScore: safeScore,
    requiredPercentage: Math.round((safeScore / upcomingAssessmentTotal) * 1000) / 10,
    isPossible: true,
    status: 'achievable',
    message: `You need at least ${safeScore}/${upcomingAssessmentTotal} (${Math.round((safeScore / upcomingAssessmentTotal) * 100)}%) on this ${component} assessment to reach ${targetQuarterlyGrade}.`,
  };
}
