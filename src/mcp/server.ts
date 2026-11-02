import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PERIODS } from '../engine/periods';
import { academicOverview, assessmentHistory, compareQuarters, forecastGeneralAverage, gradeRequirements, simulateGrade, subjectGrades, ToolInputError, upcomingAssessments } from './academic';
import { BackupError, type McpWorkspace } from './backup';

/**
 * MCP permission categories (PLAN.txt Part III). READ and SIMULATE tools are always available. WRITE tools are
 * deliberately not implemented: the data source is a read-only backup export, so an AI client cannot change records.
 */
export type ToolPermission = 'read' | 'simulate';

export const TOOL_PERMISSIONS = {
  get_academic_overview: 'read',
  get_subject_grades: 'read',
  get_assessment_history: 'read',
  get_upcoming_assessments: 'read',
  simulate_grade: 'simulate',
  get_grade_requirements: 'simulate',
  forecast_general_average: 'simulate',
  compare_quarters: 'simulate',
} as const satisfies Record<string, ToolPermission>;

export type ServerOptions = {
  /** Returns the student's records. Called for every tool call, so a newly exported backup is picked up without a restart. */
  loadWorkspace: () => McpWorkspace | Promise<McpWorkspace>;
  version?: string;
};

const component = z.enum(['ww', 'pt', 'exam']).describe('Grading component: ww = Written Works, pt = Performance Tasks, exam = Examination');
const period = z.string().describe(`Grading period, e.g. ${PERIODS.map(item => `"${item}"`).join(', ')}. Defaults to the current period.`);
const hypothetical = z.object({
  component,
  score: z.number().min(0).describe('Points earned'),
  maxScore: z.number().positive().describe('Points possible'),
  title: z.string().optional().describe('Optional label, e.g. "Unit test"'),
});

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function failure(error: unknown): CallToolResult {
  const message = error instanceof ToolInputError || error instanceof BackupError ? error.message : `AMPlifier could not complete this request: ${error instanceof Error ? error.message : String(error)}`;
  return { isError: true, content: [{ type: 'text', text: message }] };
}

export function createAmplifierMcpServer({ loadWorkspace, version = '0.2.0' }: ServerOptions): McpServer {
  const server = new McpServer({ name: 'amplifier', title: 'AMPlifier', version }, {
    instructions: 'AMPlifier is a student\'s grade tracker. Grades are 0–100. Term grades carry a source: Actual (official report card), Estimated (calculated from recorded assessments) or Projected (an assumption). Use the simulate tools for what-if questions; they never change records. All data is read-only.',
  });

  const run = <A>(tool: (ws: McpWorkspace, args: A) => unknown) => async (args: A): Promise<CallToolResult> => {
    try { return ok(tool(await loadWorkspace(), args)); } catch (error) { return failure(error); }
  };
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  /* READ */

  server.registerTool('get_academic_overview', {
    title: 'Academic overview',
    description: 'Current standing: school and period, current-period and year-to-date general averages, projected final average, target and the average still required, each subject\'s current grade and status, rule-based insights (weak subjects, declines, weakest component), and counts of upcoming work.',
    annotations: readOnly,
  }, run(ws => academicOverview(ws)));

  server.registerTool('get_subject_grades', {
    title: 'Subject grades',
    description: 'One subject in detail: current grade, component averages with their weights, every term grade with its source (Actual/Estimated/Projected), change from the previous term, and the grade needed per remaining term to reach the saved target.',
    inputSchema: { subject: z.string().describe('Subject name (case-insensitive) or code') },
    annotations: readOnly,
  }, run((ws, args: { subject: string }) => subjectGrades(ws, args.subject)));

  server.registerTool('get_assessment_history', {
    title: 'Assessment history',
    description: 'Recorded assessment scores, newest first, with percentages. Filter by subject, period and component.',
    inputSchema: {
      subject: z.string().optional().describe('Subject name or code'),
      period: period.optional(),
      component: component.optional(),
      limit: z.number().int().positive().max(500).optional().describe('Maximum number of assessments to return'),
    },
    annotations: readOnly,
  }, run(assessmentHistory));

  server.registerTool('get_upcoming_assessments', {
    title: 'Upcoming work',
    description: 'Open tasks and assessments dated after today, soonest first, including overdue tasks.',
    inputSchema: {
      days_ahead: z.number().int().min(0).optional().describe('Only include items due within this many days'),
      include_overdue: z.boolean().optional().describe('Include overdue tasks (default true)'),
    },
    annotations: readOnly,
  }, run((ws, args: { days_ahead?: number; include_overdue?: boolean }) => upcomingAssessments(ws, { daysAhead: args.days_ahead, includeOverdue: args.include_overdue })));

  /* SIMULATE */

  server.registerTool('simulate_grade', {
    title: 'Simulate a grade',
    description: 'What-if: the subject\'s grade (and the period\'s general average) if the given hypothetical assessments were added. Uses the student\'s weights and grade scale. Never saves anything.',
    inputSchema: {
      subject: z.string().describe('Subject name or code'),
      period: period.optional(),
      hypotheticals: z.array(hypothetical).min(1).max(50).describe('Hypothetical assessments to add'),
    },
    annotations: readOnly,
  }, run(simulateGrade));

  server.registerTool('get_grade_requirements', {
    title: 'Score needed for a target',
    description: 'Minimum score on one more assessment (out of max_score) for the subject\'s period grade to reach the target, or whether it is already met or out of reach. Also gives the grade needed in each remaining term for the subject\'s final grade to reach the target.',
    inputSchema: {
      subject: z.string().describe('Subject name or code'),
      component,
      max_score: z.number().positive().describe('Points possible on the next assessment'),
      target: z.number().min(0).max(100).describe('Target grade (0–100)'),
      period: period.optional(),
      pending: z.array(hypothetical).max(50).optional().describe('Other hypothetical assessments to assume first'),
    },
    annotations: readOnly,
  }, run((ws, args: { subject: string; component: 'ww' | 'pt' | 'exam'; max_score: number; target: number; period?: string; pending?: z.infer<typeof hypothetical>[] }) =>
    gradeRequirements(ws, { ...args, maxScore: args.max_score })));

  server.registerTool('forecast_general_average', {
    title: 'Forecast general average',
    description: 'Projected final general average under the conservative, realistic and optimistic scenarios, the student\'s saved assumptions, and optionally custom assumptions for terms that have no grade yet.',
    inputSchema: {
      scenario: z.enum(['all', 'saved', 'conservative', 'realistic', 'optimistic']).optional().describe('Which projection to return (default all)'),
      assumptions: z.record(z.string(), z.record(z.string(), z.number().min(0).max(100))).optional()
        .describe('Custom assumed grades by subject then period, e.g. {"Mathematics": {"Quarter 4": 92}}'),
    },
    annotations: readOnly,
  }, run(forecastGeneralAverage));

  server.registerTool('compare_quarters', {
    title: 'Compare terms',
    description: 'Compares two grading periods: general average per term and each subject\'s grade change, with the most improved subject and largest drop. Defaults to the previous term versus the current one.',
    inputSchema: { from: period.optional(), to: period.optional() },
    annotations: readOnly,
  }, run(compareQuarters));

  return server;
}
