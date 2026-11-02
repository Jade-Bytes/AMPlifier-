import { useMemo } from 'react';
import { deriveAcademicModel } from './academicModel';
import type { Workspace } from './useWorkspace';

export type { AcademicModel, UpcomingItem } from './academicModel';

/** All derived academic figures. Pure functions of the workspace; recomputed only when inputs change. */
export function useAcademicModel(ws: Workspace) {
  const { subjects, assessments, historicalGrades, tasks, settings } = ws;
  return useMemo(() => deriveAcademicModel({ subjects, assessments, historicalGrades, tasks, settings }), [subjects, assessments, historicalGrades, tasks, settings]);
}
