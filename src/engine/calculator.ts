import {
  Assessment,
  ComponentResult,
  ComponentWeight,
  GradingPeriod,
  QuarterlySubjectResult,
  AnnualSubjectResult,
  Subject,
  EstimatedReportCard,
  AcademicWeakness,
} from './types';
import { transmuteGrade } from './transmutation';

const ALL_QUARTERS: GradingPeriod[] = ['Q1', 'Q2', 'Q3', 'Q4'];

/**
 * Calculates the score standing for a single component (WW, PT, or QA).
 */
export function calculateComponentScore(
  assessments: Assessment[],
  weightPercentage: number // e.g. 0.40
): ComponentResult {
  if (!assessments || assessments.length === 0) {
    return {
      totalScore: 0,
      totalPossible: 0,
      percentageScore: 0,
      weightedScore: 0,
      count: 0,
      hasAssessments: false,
    };
  }

  let totalScore = 0;
  let totalPossible = 0;

  for (const a of assessments) {
    const multiplier = a.weightMultiplier ?? 1.0;
    totalScore += a.score * multiplier;
    totalPossible += a.totalPossible * multiplier;
  }

  if (totalPossible <= 0) {
    return {
      totalScore: 0,
      totalPossible: 0,
      percentageScore: 0,
      weightedScore: 0,
      count: assessments.length,
      hasAssessments: false,
    };
  }

  const rawPercentage = (totalScore / totalPossible) * 100;
  const percentageScore = Math.round(rawPercentage * 100) / 100;
  const weightedScore = Math.round(percentageScore * weightPercentage * 100) / 100;

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    totalPossible: Math.round(totalPossible * 100) / 100,
    percentageScore,
    weightedScore,
    count: assessments.length,
    hasAssessments: true,
  };
}

/**
 * Normalizes component weights if some components have no scores recorded yet.
 * Returns effective weights that sum to 1.0 (or raw weights if all present).
 */
export function getEffectiveWeights(
  weights: ComponentWeight,
  hasWW: boolean,
  hasPT: boolean,
  hasQA: boolean
): { effectiveWW: number; effectivePT: number; effectiveQA: number } {
  let activeWeightSum = 0;
  if (hasWW) activeWeightSum += weights.ww;
  if (hasPT) activeWeightSum += weights.pt;
  if (hasQA) activeWeightSum += weights.qa;

  if (activeWeightSum <= 0) {
    return { effectiveWW: weights.ww, effectivePT: weights.pt, effectiveQA: weights.qa };
  }

  // If all active, keep original weights
  if (hasWW && hasPT && hasQA) {
    return { effectiveWW: weights.ww, effectivePT: weights.pt, effectiveQA: weights.qa };
  }

  // Normalize so partial quarter reflects true current academic trajectory
  return {
    effectiveWW: hasWW ? weights.ww / activeWeightSum : 0,
    effectivePT: hasPT ? weights.pt / activeWeightSum : 0,
    effectiveQA: hasQA ? weights.qa / activeWeightSum : 0,
  };
}

/**
 * Calculates the standing for a subject in a specific quarter.
 */
export function calculateQuarterlySubject(
  subject: Subject,
  quarter: GradingPeriod,
  assessments: Assessment[]
): QuarterlySubjectResult {
  const quarterAssessments = assessments.filter(
    (a) => a.subjectId === subject.id && a.quarter === quarter
  );

  const wwAssessments = quarterAssessments.filter((a) => a.component === 'WW');
  const ptAssessments = quarterAssessments.filter((a) => a.component === 'PT');
  const qaAssessments = quarterAssessments.filter((a) => a.component === 'QA');

  const hasWW = wwAssessments.length > 0;
  const hasPT = ptAssessments.length > 0;
  const hasQA = qaAssessments.length > 0;

  const { effectiveWW, effectivePT, effectiveQA } = getEffectiveWeights(
    subject.weights,
    hasWW,
    hasPT,
    hasQA
  );

  const writtenWorks = calculateComponentScore(wwAssessments, effectiveWW);
  const performanceTasks = calculateComponentScore(ptAssessments, effectivePT);
  const quarterlyAssessment = calculateComponentScore(qaAssessments, effectiveQA);

  const populatedCount = (hasWW ? 1 : 0) + (hasPT ? 1 : 0) + (hasQA ? 1 : 0);
  const completionRatio = populatedCount / 3;
  const isProvisional = populatedCount < 3;

  let initialGrade = 0;
  if (populatedCount > 0) {
    initialGrade = Math.round((writtenWorks.weightedScore + performanceTasks.weightedScore + quarterlyAssessment.weightedScore) * 100) / 100;
  }

  const quarterlyGrade = subject.useTransmutation
    ? (populatedCount > 0 ? transmuteGrade(initialGrade) : 0)
    : Math.round(initialGrade);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    quarter,
    writtenWorks,
    performanceTasks,
    quarterlyAssessment,
    initialGrade,
    quarterlyGrade,
    isProvisional,
    completionRatio,
  };
}

/**
 * Detects weaknesses and risks based on calculated student performance.
 */
export function detectWeaknesses(
  subjects: AnnualSubjectResult[]
): AcademicWeakness[] {
  const weaknesses: AcademicWeakness[] = [];

  for (const annual of subjects) {
    const qGrades: number[] = [];
    const quarters = ALL_QUARTERS;

    for (const q of quarters) {
      const res = annual.quarters[q];
      if (res && res.completionRatio > 0) {
        qGrades.push(res.quarterlyGrade);

        // Check for weak individual components
        if (res.writtenWorks.hasAssessments && res.writtenWorks.percentageScore < 75) {
          weaknesses.push({
            id: `low_ww_${annual.subjectId}_${q}`,
            subjectId: annual.subjectId,
            subjectName: annual.subjectName,
            type: 'low_component',
            severity: res.writtenWorks.percentageScore < 70 ? 'high' : 'medium',
            title: `Low Written Works in ${annual.subjectName} (${q})`,
            description: `Written works average is ${res.writtenWorks.percentageScore.toFixed(1)}%, which pulls down your standing.`,
            suggestedAction: 'Review assignment deadlines, practice quiz topics, and consult study notes regularly.',
          });
        }

        if (res.performanceTasks.hasAssessments && res.performanceTasks.percentageScore < 75) {
          weaknesses.push({
            id: `low_pt_${annual.subjectId}_${q}`,
            subjectId: annual.subjectId,
            subjectName: annual.subjectName,
            type: 'low_component',
            severity: res.performanceTasks.percentageScore < 70 ? 'high' : 'medium',
            title: `Low Performance Tasks in ${annual.subjectName} (${q})`,
            description: `Performance task average is ${res.performanceTasks.percentageScore.toFixed(1)}%. PTs heavily determine your grade.`,
            suggestedAction: 'Prioritize rubrics and submission quality for upcoming hands-on projects and presentations.',
          });
        }
      }
    }

    // Check for declining trend across consecutive quarters
    if (qGrades.length >= 2) {
      const latest = qGrades[qGrades.length - 1];
      const previous = qGrades[qGrades.length - 2];
      if (latest < previous - 3) {
        weaknesses.push({
          id: `declining_${annual.subjectId}`,
          subjectId: annual.subjectId,
          subjectName: annual.subjectName,
          type: 'declining',
          severity: latest < 75 ? 'high' : 'medium',
          title: `Declining Trend in ${annual.subjectName}`,
          description: `Grade dropped from ${previous} to ${latest} (a ${Math.round(previous - latest)} point decline).`,
          suggestedAction: 'Schedule extra study sessions and target upcoming assessments using the Grade Simulator.',
        });
      }
    }

    // Check for critical impact on general average
    if (annual.projectedFinalGrade < 75) {
      weaknesses.push({
        id: `failing_risk_${annual.subjectId}`,
        subjectId: annual.subjectId,
        subjectName: annual.subjectName,
        type: 'critical_impact',
        severity: 'high',
        title: `Academic Risk in ${annual.subjectName}`,
        description: `Projected final grade is currently ${annual.projectedFinalGrade.toFixed(1)} (below the 75 passing mark).`,
        suggestedAction: 'Urgent intervention needed: calculate minimum scores required on next tasks to reach passing standing.',
      });
    }
  }

  return weaknesses;
}

/**
 * Calculates the complete Estimated Report Card including historical standings,
 * future assumptions, quarterly averages, and projected general average.
 */
export function calculateEstimatedReportCard(
  subjects: Subject[],
  assessments: Assessment[],
  futureAssumptions: Record<string, Partial<Record<GradingPeriod, number>>> = {}
): EstimatedReportCard {
  const annualResults: AnnualSubjectResult[] = [];
  const quarterlyResultsMap = new Map<string, QuarterlySubjectResult>();

  for (const subject of subjects) {
    const quarters: Record<GradingPeriod, QuarterlySubjectResult | null> = {
      Q1: null,
      Q2: null,
      Q3: null,
      Q4: null,
    };

    let completedGradesSum = 0;
    let completedQuartersCount = 0;
    let projectedGradesSum = 0;

    for (const q of ALL_QUARTERS) {
      const qResult = calculateQuarterlySubject(subject, q, assessments);
      const key = `${subject.id}_${q}`;
      quarterlyResultsMap.set(key, qResult);

      if (qResult.completionRatio > 0) {
        quarters[q] = qResult;
        completedGradesSum += qResult.quarterlyGrade;
        completedQuartersCount += 1;
        projectedGradesSum += qResult.quarterlyGrade;
      } else {
        // Quarter is unpopulated: use explicit future assumption if provided, or default to current subject average / 75
        const userAssumed = futureAssumptions[subject.id]?.[q];
        let assumedGrade = userAssumed;

        if (assumedGrade === undefined) {
          assumedGrade = completedQuartersCount > 0
            ? Math.round(completedGradesSum / completedQuartersCount)
            : 75; // Default neutral baseline
        }

        projectedGradesSum += assumedGrade;
      }
    }

    const actualFinalGrade =
      completedQuartersCount === 4
        ? Math.round((completedGradesSum / 4) * 100) / 100
        : null;

    const projectedFinalGrade = Math.round((projectedGradesSum / 4) * 100) / 100;

    annualResults.push({
      subjectId: subject.id,
      subjectName: subject.name,
      quarters,
      actualFinalGrade,
      projectedFinalGrade,
    });
  }

  // Calculate Quarterly Averages
  const quarterlyAverages: Record<GradingPeriod, number | null> = {
    Q1: null,
    Q2: null,
    Q3: null,
    Q4: null,
  };

  for (const q of ALL_QUARTERS) {
    let qTotalWeighted = 0;
    let qTotalUnits = 0;
    let subjectsWithQuarter = 0;

    for (const s of subjects) {
      const qRes = quarterlyResultsMap.get(`${s.id}_${q}`);
      if (qRes && qRes.completionRatio > 0) {
        const units = s.units ?? 1.0;
        qTotalWeighted += qRes.quarterlyGrade * units;
        qTotalUnits += units;
        subjectsWithQuarter += 1;
      }
    }

    if (subjectsWithQuarter > 0 && qTotalUnits > 0) {
      quarterlyAverages[q] = Math.round((qTotalWeighted / qTotalUnits) * 100) / 100;
    }
  }

  // Current General Average: based on completed quarters
  let completedQuartersAverageSum = 0;
  let populatedQuarterCount = 0;
  for (const q of ALL_QUARTERS) {
    if (quarterlyAverages[q] !== null) {
      completedQuartersAverageSum += quarterlyAverages[q]!;
      populatedQuarterCount++;
    }
  }

  const currentGeneralAverage =
    populatedQuarterCount > 0
      ? Math.round((completedQuartersAverageSum / populatedQuarterCount) * 100) / 100
      : null;

  // Projected Final General Average: based on subject projectedFinalGrades weighted by units
  let totalProjectedWeighted = 0;
  let totalUnits = 0;

  for (const s of subjects) {
    const annual = annualResults.find((a) => a.subjectId === s.id);
    const units = s.units ?? 1.0;
    if (annual) {
      totalProjectedWeighted += annual.projectedFinalGrade * units;
      totalUnits += units;
    }
  }

  const projectedGeneralAverage =
    totalUnits > 0
      ? Math.round((totalProjectedWeighted / totalUnits) * 100) / 100
      : 75.0;

  const weaknesses = detectWeaknesses(annualResults);

  return {
    subjects: annualResults,
    quarterlyAverages,
    currentGeneralAverage,
    projectedGeneralAverage,
    futureAssumptions,
    weaknesses,
  };
}
