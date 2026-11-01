import { describe, it, expect } from 'vitest';
import {
  transmuteGrade,
  getMinimumInitialGradeForTransmuted,
} from '../transmutation';
import {
  calculateComponentScore,
  calculateQuarterlySubject,
  calculateEstimatedReportCard,
} from '../calculator';
import { simulateAssessments, calculateRequiredScore } from '../simulator';
import {
  generateStandardScenarios,
  calculateMinimumFutureGradesForTargetGA,
} from '../forecaster';
import { DEFAULT_DEPED_TEMPLATE } from '../templates';
import { Assessment, Subject } from '../types';

describe('DepEd Transmutation Table (Order No. 8, s. 2015)', () => {
  it('correctly transmutes standard milestone boundaries', () => {
    expect(transmuteGrade(100)).toBe(100);
    expect(transmuteGrade(98.4)).toBe(99);
    expect(transmuteGrade(96.8)).toBe(98);
    expect(transmuteGrade(92.0)).toBe(95);
    expect(transmuteGrade(90.4)).toBe(94);
    expect(transmuteGrade(80.8)).toBe(88);
    expect(transmuteGrade(60.0)).toBe(75); // Passing threshold
    expect(transmuteGrade(56.0)).toBe(74);
    expect(transmuteGrade(0.0)).toBe(60);
  });

  it('handles out of bounds cleanly', () => {
    expect(transmuteGrade(105)).toBe(100);
    expect(transmuteGrade(-10)).toBe(60);
  });

  it('correctly performs reverse lookup for target grades', () => {
    expect(getMinimumInitialGradeForTransmuted(100)).toBe(100);
    expect(getMinimumInitialGradeForTransmuted(95)).toBe(92.0);
    expect(getMinimumInitialGradeForTransmuted(75)).toBe(60.0);
    expect(getMinimumInitialGradeForTransmuted(60)).toBe(0.0);
  });
});

describe('Deterministic Grading Engine - Component Calculations', () => {
  it('returns empty result when no assessments provided', () => {
    const res = calculateComponentScore([], 0.40);
    expect(res.hasAssessments).toBe(false);
    expect(res.totalScore).toBe(0);
    expect(res.totalPossible).toBe(0);
    expect(res.percentageScore).toBe(0);
    expect(res.weightedScore).toBe(0);
  });

  it('accurately computes sum and percentage with multipliers', () => {
    const assessments: Assessment[] = [
      {
        id: '1',
        subjectId: 'sub1',
        quarter: 'Q1',
        component: 'WW',
        title: 'Quiz 1',
        score: 18,
        totalPossible: 20,
      },
      {
        id: '2',
        subjectId: 'sub1',
        quarter: 'Q1',
        component: 'WW',
        title: 'Quiz 2',
        score: 20,
        totalPossible: 20,
      },
      {
        id: '3',
        subjectId: 'sub1',
        quarter: 'Q1',
        component: 'WW',
        title: 'Major Seatwork',
        score: 25,
        totalPossible: 30,
        weightMultiplier: 2.0, // counts twice: 50 / 60
      },
    ];

    // (18 + 20 + 25*2) / (20 + 20 + 30*2) = 88 / 100 = 88%
    // weighted with 0.40 = 35.2
    const res = calculateComponentScore(assessments, 0.40);
    expect(res.hasAssessments).toBe(true);
    expect(res.totalScore).toBe(88);
    expect(res.totalPossible).toBe(100);
    expect(res.percentageScore).toBe(88);
    expect(res.weightedScore).toBe(35.2);
  });
});

describe('Quarterly Subject Calculation & Normalization', () => {
  const scienceSubject: Subject = {
    id: 'sci-1',
    name: 'Science',
    weights: { ww: 0.40, pt: 0.40, qa: 0.20 },
    units: 1.0,
    useTransmutation: true,
  };

  it('normalizes proportionally when only Written Works exist early in the quarter', () => {
    const assessments: Assessment[] = [
      {
        id: '1',
        subjectId: 'sci-1',
        quarter: 'Q1',
        component: 'WW',
        title: 'Quiz 1',
        score: 18,
        totalPossible: 20, // 90%
      },
    ];

    const res = calculateQuarterlySubject(scienceSubject, 'Q1', assessments);
    expect(res.isProvisional).toBe(true);
    expect(res.completionRatio).toBeCloseTo(1 / 3, 2);
    // Effective WW weight becomes 1.0 since it is the only active component
    expect(res.initialGrade).toBe(90);
    // 90 transmutes to 93 in DepEd table (88.80 - 90.39)
    expect(res.quarterlyGrade).toBe(93);
  });

  it('calculates full subject standing when all 3 components are populated', () => {
    const assessments: Assessment[] = [
      // WW: 40/50 = 80% (weight 0.40 -> 32)
      { id: '1', subjectId: 'sci-1', quarter: 'Q1', component: 'WW', title: 'Q1', score: 40, totalPossible: 50 },
      // PT: 90/100 = 90% (weight 0.40 -> 36)
      { id: '2', subjectId: 'sci-1', quarter: 'Q1', component: 'PT', title: 'P1', score: 90, totalPossible: 100 },
      // QA: 45/50 = 90% (weight 0.20 -> 18)
      { id: '3', subjectId: 'sci-1', quarter: 'Q1', component: 'QA', title: 'Exam', score: 45, totalPossible: 50 },
    ];

    const res = calculateQuarterlySubject(scienceSubject, 'Q1', assessments);
    expect(res.isProvisional).toBe(false);
    expect(res.completionRatio).toBe(1.0);
    // Total Initial Grade = 32 + 36 + 18 = 86
    expect(res.initialGrade).toBe(86);
    // 86 in DepEd table (85.60 - 87.19) = 91
    expect(res.quarterlyGrade).toBe(91);
  });
});

describe('Estimated Report Card & General Average', () => {
  const subjects: Subject[] = DEFAULT_DEPED_TEMPLATE.subjects.map((s, idx) => ({
    ...s,
    id: `subj_${idx}`,
  }));

  it('calculates projected General Average and honors status', () => {
    // Populate Q1 for all 8 subjects with scores yielding ~90 initial grade (transmuted ~94)
    const assessments: Assessment[] = [];
    for (const s of subjects) {
      assessments.push(
        { id: `${s.id}_ww`, subjectId: s.id, quarter: 'Q1', component: 'WW', title: 'WW', score: 90, totalPossible: 100 },
        { id: `${s.id}_pt`, subjectId: s.id, quarter: 'Q1', component: 'PT', title: 'PT', score: 90, totalPossible: 100 },
        { id: `${s.id}_qa`, subjectId: s.id, quarter: 'Q1', component: 'QA', title: 'QA', score: 90, totalPossible: 100 }
      );
    }

    const reportCard = calculateEstimatedReportCard(subjects, assessments);
    expect(reportCard.quarterlyAverages.Q1).toBe(93);
    expect(reportCard.currentGeneralAverage).toBe(93);
    // Since Q2, Q3, Q4 are unpopulated, they project the historical average (93)
    expect(reportCard.projectedGeneralAverage).toBe(93);
  });
});

describe('Grade Simulator (What-If Analysis)', () => {
  const subjects: Subject[] = [
    {
      id: 'eng',
      name: 'English',
      weights: { ww: 0.40, pt: 0.40, qa: 0.20 },
      units: 1.0,
      useTransmutation: true,
    },
  ];

  it('simulates the impact of hypothetical assessments without altering records', () => {
    const existingAssessments: Assessment[] = [
      { id: '1', subjectId: 'eng', quarter: 'Q1', component: 'WW', title: 'Quiz 1', score: 15, totalPossible: 20 }, // 75%
    ];

    const hypothetical: Assessment[] = [
      { id: 'hypo_1', subjectId: 'eng', quarter: 'Q1', component: 'WW', title: 'Quiz 2', score: 20, totalPossible: 20 }, // 100%
    ];

    const result = simulateAssessments(subjects, existingAssessments, hypothetical);
    // Before: 15/20 = 75% -> transmuted = 84
    expect(result.subjectGradeBefore).toBe(84);
    // After: (15+20)/(20+20) = 35/40 = 87.5% -> transmuted = 92
    expect(result.subjectGradeAfter).toBe(92);
    expect(result.subjectGradeDelta).toBe(8);
  });

  it('calculates exact required score on an upcoming exam to achieve a target grade', () => {
    const existingAssessments: Assessment[] = [
      // WW: 100% (weight 0.40 -> 40 points)
      { id: '1', subjectId: 'eng', quarter: 'Q1', component: 'WW', title: 'WW', score: 100, totalPossible: 100 },
      // PT: 100% (weight 0.40 -> 40 points)
      { id: '2', subjectId: 'eng', quarter: 'Q1', component: 'PT', title: 'PT', score: 100, totalPossible: 100 },
      // We need Exam score for target transmuted 95.
      // Target transmuted 95 requires initial grade >= 92.0.
      // Already earned from WW + PT = 40 + 40 = 80.
      // QA must supply 92.0 - 80 = 12.0 weighted points.
      // Since QA weight is 0.20: percentage = 12.0 / 0.20 = 60%.
      // On a 50-point exam: 60% of 50 = 30 points.
    ];

    const requirement = calculateRequiredScore(
      subjects[0],
      'Q1',
      'QA',
      95,
      existingAssessments,
      50
    );

    expect(requirement.isPossible).toBe(true);
    expect(requirement.requiredScore).toBe(30);
    expect(requirement.requiredPercentage).toBe(60);
  });
});

describe('Advanced Forecasting & General Average Target Solver', () => {
  const subjects: Subject[] = [
    { id: 's1', name: 'Subject 1', weights: { ww: 0.4, pt: 0.4, qa: 0.2 }, units: 1, useTransmutation: true },
    { id: 's2', name: 'Subject 2', weights: { ww: 0.4, pt: 0.4, qa: 0.2 }, units: 1, useTransmutation: true },
  ];

  it('generates Conservative, Realistic, and Optimistic forecasting scenarios', () => {
    const assessments: Assessment[] = [
      { id: '1', subjectId: 's1', quarter: 'Q1', component: 'WW', title: 'W1', score: 85, totalPossible: 100 },
      { id: '2', subjectId: 's1', quarter: 'Q1', component: 'PT', title: 'P1', score: 85, totalPossible: 100 },
      { id: '3', subjectId: 's1', quarter: 'Q1', component: 'QA', title: 'Q1', score: 85, totalPossible: 100 },
      { id: '4', subjectId: 's2', quarter: 'Q1', component: 'WW', title: 'W2', score: 85, totalPossible: 100 },
      { id: '5', subjectId: 's2', quarter: 'Q1', component: 'PT', title: 'P2', score: 85, totalPossible: 100 },
      { id: '6', subjectId: 's2', quarter: 'Q1', component: 'QA', title: 'Q2', score: 85, totalPossible: 100 },
    ];

    const scenarios = generateStandardScenarios(subjects, assessments);
    expect(scenarios.length).toBe(3);
    const [conservative, realistic, optimistic] = scenarios;

    expect(realistic.projectedGeneralAverage).toBeGreaterThanOrEqual(conservative.projectedGeneralAverage);
    expect(optimistic.projectedGeneralAverage).toBeGreaterThanOrEqual(realistic.projectedGeneralAverage);
  });

  it('solves required future average to attain target general average', () => {
    // Both subjects have Q1 grade = 88.
    // Remaining quarters Q2, Q3, Q4 (3 quarters * 2 subjects = 6 quarter slots).
    // Target GA = 91.
    const assessments: Assessment[] = [
      { id: '1', subjectId: 's1', quarter: 'Q1', component: 'WW', title: 'W1', score: 81, totalPossible: 100 },
      { id: '2', subjectId: 's1', quarter: 'Q1', component: 'PT', title: 'P1', score: 81, totalPossible: 100 },
      { id: '3', subjectId: 's1', quarter: 'Q1', component: 'QA', title: 'Q1', score: 81, totalPossible: 100 },
      { id: '4', subjectId: 's2', quarter: 'Q1', component: 'WW', title: 'W2', score: 81, totalPossible: 100 },
      { id: '5', subjectId: 's2', quarter: 'Q1', component: 'PT', title: 'P2', score: 81, totalPossible: 100 },
      { id: '6', subjectId: 's2', quarter: 'Q1', component: 'QA', title: 'Q2', score: 81, totalPossible: 100 },
    ];

    const plan = calculateMinimumFutureGradesForTargetGA(subjects, assessments, 91);
    expect(plan.isAchievable).toBe(true);
    // 88 in Q1, to average 91 across 4 quarters: (88 + 3 * X) / 4 = 91 -> 88 + 3X = 364 -> 3X = 276 -> X = 92
    expect(plan.requiredAverageOnRemaining).toBe(92);
  });
});
