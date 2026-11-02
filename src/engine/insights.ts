import type { Assessment, GradeComponent, Subject } from '../types/app';
import { COMPONENT_LABELS, COMPONENTS, scoreAsPercent } from './calculator';
import { mean } from './reportCard';

export type InsightSeverity = 'positive' | 'info' | 'attention';
export type Insight = { id: string; severity: InsightSeverity; title: string; detail: string; subject?: string };

export type InsightInput = {
  /** Subjects calculated for the current period. */
  subjects: Subject[];
  assessments: Assessment[];
  period: string;
  passingGrade: number;
  /** Grade change from the previous term, by subject name (null when not comparable). */
  changes: Record<string, number | null>;
};

const fmt = (value: number) => value.toFixed(1);

function standardDeviation(values: number[]): number {
  const avg = mean(values) ?? 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}

/**
 * Rule-based academic signals (weakness detection). Deterministic and explainable: every message
 * states the numbers it is based on. Ordered by priority: attention first.
 */
export function academicInsights({ subjects, assessments, period, passingGrade, changes }: InsightInput): Insight[] {
  const graded = subjects.filter(subject => subject.hasGrades);
  if (!graded.length) return [];
  const insights: Insight[] = [];

  for (const subject of graded.filter(item => item.grade < passingGrade).sort((a, b) => a.grade - b.grade)) {
    const change = changes[subject.name];
    const drop = change !== null && change !== undefined && change <= -2 ? ` Down ${fmt(Math.abs(change))} from the previous term.` : '';
    insights.push({ id: `below-${subject.name}`, severity: 'attention', subject: subject.name, title: `${subject.name} is below passing`, detail: `Estimated ${fmt(subject.grade)} against a passing grade of ${passingGrade}.${drop}` });
  }

  for (const subject of graded.filter(item => item.grade >= passingGrade)) {
    const change = changes[subject.name];
    if (change !== null && change !== undefined && change <= -2) {
      insights.push({ id: `decline-${subject.name}`, severity: 'attention', subject: subject.name, title: `${subject.name} dropped ${fmt(Math.abs(change))} points`, detail: 'Compared with the previous term’s recorded grade.' });
    }
  }

  // Weakest grading component across all subjects that have it.
  const componentMeans = COMPONENTS.map(component => {
    const key = `${component}HasGrades` as const;
    const values = graded.filter(subject => subject[key]).map(subject => subject[component]);
    return { component, average: mean(values), count: values.length };
  }).filter((item): item is { component: GradeComponent; average: number; count: number } => item.average !== null);
  if (componentMeans.length > 1) {
    const weakest = [...componentMeans].sort((a, b) => a.average - b.average)[0];
    const strongest = [...componentMeans].sort((a, b) => b.average - a.average)[0];
    if (strongest.average - weakest.average >= 5) {
      insights.push({ id: `component-${weakest.component}`, severity: 'info', title: `${COMPONENT_LABELS[weakest.component]} is your weakest component`, detail: `Averages ${fmt(weakest.average)}% across ${weakest.count} subject${weakest.count === 1 ? '' : 's'}, vs ${fmt(strongest.average)}% for ${COMPONENT_LABELS[strongest.component]}.` });
    }
  }

  // Inconsistent results: wide spread of assessment percentages within one subject this period.
  for (const subject of graded) {
    const percents = assessments.filter(item => item.subject === subject.name && item.period === period).map(item => scoreAsPercent(item.score, item.maxScore));
    if (percents.length >= 3) {
      const spread = standardDeviation(percents);
      if (spread >= 12) insights.push({ id: `spread-${subject.name}`, severity: 'info', subject: subject.name, title: `${subject.name} scores vary widely`, detail: `Assessment results range from ${Math.min(...percents).toFixed(0)}% to ${Math.max(...percents).toFixed(0)}% this period.` });
    }
  }

  // Subject with the greatest negative pull on the average.
  if (graded.length > 1) {
    const average = mean(graded.map(subject => subject.grade))!;
    const lowest = [...graded].sort((a, b) => a.grade - b.grade)[0];
    const pull = (average - lowest.grade) / graded.length;
    if (pull >= 0.3 && lowest.grade >= passingGrade) {
      insights.push({ id: `impact-${lowest.name}`, severity: 'info', subject: lowest.name, title: `${lowest.name} has the most room to lift your average`, detail: `Raising it to your current average (${fmt(average)}) would add about ${fmt(pull)} points overall.` });
    }
    const highest = [...graded].sort((a, b) => b.grade - a.grade)[0];
    insights.push({ id: `strong-${highest.name}`, severity: 'positive', subject: highest.name, title: `${highest.name} is your strongest subject`, detail: `Estimated ${fmt(highest.grade)} for ${period}.` });
  }

  for (const subject of graded) {
    const change = changes[subject.name];
    if (change !== null && change !== undefined && change >= 2) {
      insights.push({ id: `improve-${subject.name}`, severity: 'positive', subject: subject.name, title: `${subject.name} improved ${fmt(change)} points`, detail: 'Compared with the previous term’s recorded grade.' });
    }
  }

  const order: Record<InsightSeverity, number> = { attention: 0, info: 1, positive: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}
