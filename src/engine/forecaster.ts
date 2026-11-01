import { Assessment, GradingPeriod, Subject } from './types';
import { calculateEstimatedReportCard } from './calculator';

export interface ForecastingScenario {
  id: string;
  name: string;
  type: 'conservative' | 'realistic' | 'optimistic' | 'custom';
  description: string;
  futureAssumptions: Record<string, Partial<Record<GradingPeriod, number>>>;
  projectedGeneralAverage: number;
  subjectProjections: Record<string, number>; // subjectId -> projected final grade
}

export interface TargetGAPlan {
  targetGeneralAverage: number;
  currentCompletedAverage: number | null;
  remainingQuartersCount: number;
  requiredAverageOnRemaining: number;
  isAchievable: boolean;
  status: 'achieved' | 'achievable' | 'impossible_too_high' | 'impossible_too_low';
  recommendedSubjectAssumptions: Record<string, Partial<Record<GradingPeriod, number>>>;
  summary: string;
}

const ALL_QUARTERS: GradingPeriod[] = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Generates the 3 standard forecasting scenarios: Realistic, Conservative, and Optimistic.
 */
export function generateStandardScenarios(
  subjects: Subject[],
  assessments: Assessment[]
): ForecastingScenario[] {
  const currentBase = calculateEstimatedReportCard(subjects, assessments);

  // Identify completed quarters per subject
  const realisticAssumptions: Record<string, Partial<Record<GradingPeriod, number>>> = {};
  const conservativeAssumptions: Record<string, Partial<Record<GradingPeriod, number>>> = {};
  const optimisticAssumptions: Record<string, Partial<Record<GradingPeriod, number>>> = {};

  for (const sub of subjects) {
    const annual = currentBase.subjects.find((s) => s.subjectId === sub.id);
    realisticAssumptions[sub.id] = {};
    conservativeAssumptions[sub.id] = {};
    optimisticAssumptions[sub.id] = {};

    let completedSum = 0;
    let completedCount = 0;

    for (const q of ALL_QUARTERS) {
      const qRes = annual?.quarters[q];
      if (qRes && qRes.completionRatio > 0) {
        completedSum += qRes.quarterlyGrade;
        completedCount++;
      }
    }

    const baseline = completedCount > 0 ? Math.round(completedSum / completedCount) : 85;

    for (const q of ALL_QUARTERS) {
      const qRes = annual?.quarters[q];
      if (!qRes || qRes.completionRatio === 0) {
        // Uncompleted quarter
        const realisticGrade = baseline;
        const conservativeGrade = Math.max(75, baseline - 4);
        const optimisticGrade = Math.min(99, baseline + 4);

        realisticAssumptions[sub.id][q] = realisticGrade;
        conservativeAssumptions[sub.id][q] = conservativeGrade;
        optimisticAssumptions[sub.id][q] = optimisticGrade;
      }
    }
  }

  // Calculate projected cards for each scenario
  const realisticCard = calculateEstimatedReportCard(subjects, assessments, realisticAssumptions);
  const conservativeCard = calculateEstimatedReportCard(subjects, assessments, conservativeAssumptions);
  const optimisticCard = calculateEstimatedReportCard(subjects, assessments, optimisticAssumptions);

  const extractSubjectProjections = (card: typeof realisticCard) => {
    const map: Record<string, number> = {};
    for (const s of card.subjects) {
      map[s.subjectId] = s.projectedFinalGrade;
    }
    return map;
  };

  return [
    {
      id: 'conservative',
      name: 'Conservative Scenario',
      type: 'conservative',
      description: 'Pessimistic baseline (4 points lower on upcoming grading periods, min 75).',
      futureAssumptions: conservativeAssumptions,
      projectedGeneralAverage: conservativeCard.projectedGeneralAverage,
      subjectProjections: extractSubjectProjections(conservativeCard),
    },
    {
      id: 'realistic',
      name: 'Realistic Scenario',
      type: 'realistic',
      description: 'Expects future performance to mirror current historical subject averages.',
      futureAssumptions: realisticAssumptions,
      projectedGeneralAverage: realisticCard.projectedGeneralAverage,
      subjectProjections: extractSubjectProjections(realisticCard),
    },
    {
      id: 'optimistic',
      name: 'Optimistic Scenario',
      type: 'optimistic',
      description: 'Targeted surge (+4 points higher on future grading periods, max 99).',
      futureAssumptions: optimisticAssumptions,
      projectedGeneralAverage: optimisticCard.projectedGeneralAverage,
      subjectProjections: extractSubjectProjections(optimisticCard),
    },
  ];
}

/**
 * Calculates the exact minimum average required across all remaining quarters and subjects
 * to achieve a specific target final General Average (e.g. 90 with honors, 95 with high honors).
 */
export function calculateMinimumFutureGradesForTargetGA(
  subjects: Subject[],
  assessments: Assessment[],
  targetGeneralAverage: number
): TargetGAPlan {
  const currentCard = calculateEstimatedReportCard(subjects, assessments);

  let totalUnitWeight = 0;
  for (const s of subjects) {
    totalUnitWeight += s.units ?? 1.0;
  }

  // Identify how many quarter slots exist across all subjects (e.g., 8 subjects * 4 quarters = 32 slots)
  // And calculate sum of points already earned in completed quarters
  let completedPoints = 0;
  let completedWeight = 0;
  let remainingWeight = 0;
  const remainingQuarterCounts: Record<string, number> = {};

  for (const s of subjects) {
    const units = s.units ?? 1.0;
    const annual = currentCard.subjects.find((item) => item.subjectId === s.id);
    let remCount = 0;

    for (const q of ALL_QUARTERS) {
      const qRes = annual?.quarters[q];
      if (qRes && qRes.completionRatio > 0) {
        // Quarter completed
        completedPoints += (qRes.quarterlyGrade * units) / 4;
        completedWeight += units / 4;
      } else {
        // Quarter remains
        remCount++;
        remainingWeight += units / 4;
      }
    }
    remainingQuarterCounts[s.id] = remCount;
  }

  // Total required points across the entire year = targetGeneralAverage * totalUnitWeight
  const totalTargetPoints = targetGeneralAverage * totalUnitWeight;
  const pointsNeededFromRemaining = totalTargetPoints - completedPoints;

  if (remainingWeight <= 0) {
    const finalGA = currentCard.currentGeneralAverage ?? 75;
    const isAchieved = finalGA >= targetGeneralAverage;
    return {
      targetGeneralAverage,
      currentCompletedAverage: finalGA,
      remainingQuartersCount: 0,
      requiredAverageOnRemaining: 0,
      isAchievable: isAchieved,
      status: isAchieved ? 'achieved' : 'impossible_too_high',
      recommendedSubjectAssumptions: {},
      summary: `All grading periods are completed. Final General Average is ${finalGA}.`,
    };
  }

  const requiredAverageOnRemaining =
    Math.round((pointsNeededFromRemaining / remainingWeight) * 10) / 10;

  // Build recommended assumptions evenly or bounded
  const recommended: Record<string, Partial<Record<GradingPeriod, number>>> = {};
  for (const s of subjects) {
    recommended[s.id] = {};
    const annual = currentCard.subjects.find((item) => item.subjectId === s.id);
    for (const q of ALL_QUARTERS) {
      const qRes = annual?.quarters[q];
      if (!qRes || qRes.completionRatio === 0) {
        recommended[s.id][q] = Math.min(100, Math.max(60, Math.round(requiredAverageOnRemaining)));
      }
    }
  }

  if (requiredAverageOnRemaining > 100) {
    return {
      targetGeneralAverage,
      currentCompletedAverage: currentCard.currentGeneralAverage,
      remainingQuartersCount: Math.round(remainingWeight * 4 / (totalUnitWeight || 1)),
      requiredAverageOnRemaining,
      isAchievable: false,
      status: 'impossible_too_high',
      recommendedSubjectAssumptions: recommended,
      summary: `Target ${targetGeneralAverage} GA is mathematically unattainable: requires an average of ${requiredAverageOnRemaining.toFixed(1)} across all remaining quarters.`,
    };
  }

  if (requiredAverageOnRemaining < 60) {
    return {
      targetGeneralAverage,
      currentCompletedAverage: currentCard.currentGeneralAverage,
      remainingQuartersCount: Math.round(remainingWeight * 4 / (totalUnitWeight || 1)),
      requiredAverageOnRemaining: 60,
      isAchievable: true,
      status: 'achievable',
      recommendedSubjectAssumptions: recommended,
      summary: `Target ${targetGeneralAverage} GA is already virtually secured! Minimum passing grades (60+) in remaining quarters will suffice.`,
    };
  }

  return {
    targetGeneralAverage,
    currentCompletedAverage: currentCard.currentGeneralAverage,
    remainingQuartersCount: Math.round(remainingWeight * 4 / (totalUnitWeight || 1)),
    requiredAverageOnRemaining,
    isAchievable: true,
    status: 'achievable',
    recommendedSubjectAssumptions: recommended,
    summary: `To achieve a final General Average of ${targetGeneralAverage}, you need to maintain an average grade of at least ${requiredAverageOnRemaining.toFixed(1)} across remaining subjects and quarters.`,
  };
}
