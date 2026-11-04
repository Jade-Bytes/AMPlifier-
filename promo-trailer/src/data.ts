/** The trailer's sample grades. Every grade on screen comes from here, and scripts/verify-numbers.mts checks them. */
export const TARGET = 95;

export const SUBJECTS = [
  { name: 'Math', grade: 94.0 },
  { name: 'English', grade: 96.5 },
  { name: 'Science', grade: 95.2 },
  { name: 'Filipino', grade: 94.8 },
  { name: 'AP', grade: 93.7 },
  { name: 'ESP', grade: 97.1 },
  { name: 'MAPEH', grade: 96.3 },
  { name: 'TLE', grade: 92.6 },
] as const;

export const generalAverage = () => SUBJECTS.reduce((sum, s) => sum + s.grade, 0) / SUBJECTS.length;

/** Weights 40 / 40 / 20. Rounded to one decimal, as the app displays grades. */
export const EXAM_MAX = 50;
export const WRITTEN = { percent: 96, weight: 40 };
export const TASKS = { percent: 94, weight: 40 };
export const EXAM_WEIGHT = 20;
const round1 = (value: number) => Math.round(value * 10) / 10;
export const writtenAdds = () => round1((WRITTEN.percent * WRITTEN.weight) / 100);
export const tasksAdds = () => round1((TASKS.percent * TASKS.weight) / 100);
export const examPercent = (score: number) => (score / EXAM_MAX) * 100;
export const examAdds = (score: number) => round1((examPercent(score) * EXAM_WEIGHT) / 100);
export const termGrade = (score: number) => round1(writtenAdds() + tasksAdds() + examAdds(score));

/** Fraction of a meter's height, on the landing page's 60 to 100 scale. */
export const toLevel = (grade: number, low = 60, high = 100) => Math.max(0, Math.min(1, (grade - low) / (high - low)));

export const SITE = 'jade-bytes.github.io/AMPlifier-/landing.html';
