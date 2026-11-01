import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { calculateEstimatedReportCard } from '../engine/calculator';
import { simulateAssessments, calculateRequiredScore } from '../engine/simulator';
import { generateStandardScenarios, calculateMinimumFutureGradesForTargetGA } from '../engine/forecaster';
import { AppData } from '../types/app';
import { Assessment, GradingComponent, GradingPeriod } from '../engine/types';
import { createInitialData } from '../storage/localStore';

/**
 * File-backed persistence helper for MCP server running in Node/CLI context.
 */
const DATA_FILE_PATH = path.resolve(process.env.AMPLIFIER_DATA_PATH || './amplifier_data.json');

function loadData(): AppData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed reading data file:', err);
  }
  return createInitialData();
}

function saveData(data: AppData): void {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed saving data file:', err);
  }
}

export function createAmplifierMcpServer() {
  const server = new McpServer({
    name: 'AMPlifier Academic Intelligence Server',
    version: '1.0.0',
  });

  // 1. Tool: get_academic_overview (READ)
  server.tool(
    'get_academic_overview',
    'Retrieve the user academic overview, current standing, general average, and detected academic weaknesses.',
    {},
    async () => {
      const data = loadData();
      const reportCard = calculateEstimatedReportCard(
        data.subjects,
        data.assessments,
        data.futureAssumptions
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                student: data.user.name,
                school: data.school.schoolName,
                gradeLevel: data.school.gradeLevel,
                section: data.school.section,
                academicYear: data.school.academicYear,
                activeQuarter: data.school.activeQuarter,
                currentGeneralAverage: reportCard.currentGeneralAverage,
                projectedGeneralAverage: reportCard.projectedGeneralAverage,
                subjectsCount: data.subjects.length,
                pendingTasksCount: data.tasks.filter((t) => !t.isCompleted).length,
                detectedWeaknesses: reportCard.weaknesses,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. Tool: get_subject_grades (READ)
  server.tool(
    'get_subject_grades',
    'Retrieve estimated quarterly grades, component standing, and projected final grades for a subject or all subjects.',
    {
      subjectNameOrId: z.string().optional().describe('Filter by subject name (e.g. Science, English) or subject ID'),
    },
    async ({ subjectNameOrId }) => {
      const data = loadData();
      const reportCard = calculateEstimatedReportCard(
        data.subjects,
        data.assessments,
        data.futureAssumptions
      );

      let targetSubjects = reportCard.subjects;
      if (subjectNameOrId) {
        const query = subjectNameOrId.toLowerCase();
        targetSubjects = reportCard.subjects.filter(
          (s) =>
            s.subjectId.toLowerCase() === query ||
            s.subjectName.toLowerCase().includes(query)
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(targetSubjects, null, 2),
          },
        ],
      };
    }
  );

  // 3. Tool: get_upcoming_assessments (READ)
  server.tool(
    'get_upcoming_assessments',
    'Retrieve pending academic assignments, quizzes, examinations, and project deadlines.',
    {
      onlyPending: z.boolean().default(true).describe('Filter to only uncompleted tasks'),
    },
    async ({ onlyPending }) => {
      const data = loadData();
      const tasks = onlyPending ? data.tasks.filter((t) => !t.isCompleted) : data.tasks;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    }
  );

  // 4. Tool: simulate_grade (SIMULATE)
  server.tool(
    'simulate_grade',
    'Perform a hypothetical what-if calculation to test how an assessment score affects subject standing and general average without modifying actual records.',
    {
      subjectNameOrId: z.string().describe('Subject name or ID (e.g. Science, English)'),
      quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).describe('Grading period'),
      component: z.enum(['WW', 'PT', 'QA']).describe('Component: WW (Written Works), PT (Performance Tasks), QA (Quarterly Exam)'),
      hypotheticalScore: z.number().describe('Hypothetical score earned'),
      totalPossible: z.number().describe('Total possible score'),
    },
    async ({ subjectNameOrId, quarter, component, hypotheticalScore, totalPossible }) => {
      const data = loadData();
      const targetSub = data.subjects.find(
        (s) =>
          s.id.toLowerCase() === subjectNameOrId.toLowerCase() ||
          s.name.toLowerCase().includes(subjectNameOrId.toLowerCase())
      );

      if (!targetSub) {
        return {
          content: [
            {
              type: 'text',
              text: `Subject "${subjectNameOrId}" not found. Available subjects: ${data.subjects.map((s) => s.name).join(', ')}`,
            },
          ],
        };
      }

      const hypothetical: Assessment[] = [
        {
          id: 'mcp_hypo',
          subjectId: targetSub.id,
          quarter: quarter as GradingPeriod,
          component: component as GradingComponent,
          title: 'MCP Simulation',
          score: hypotheticalScore,
          totalPossible,
        },
      ];

      const sim = simulateAssessments(
        data.subjects,
        data.assessments,
        hypothetical,
        data.futureAssumptions
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                subject: targetSub.name,
                quarter,
                component,
                hypotheticalAssessment: `${hypotheticalScore}/${totalPossible} (${Math.round((hypotheticalScore / totalPossible) * 100)}%)`,
                subjectGradeBefore: sim.subjectGradeBefore,
                subjectGradeAfter: sim.subjectGradeAfter,
                subjectGradeDelta: sim.subjectGradeDelta,
                generalAverageBefore: sim.generalAverageBefore,
                generalAverageAfter: sim.generalAverageAfter,
                generalAverageDelta: sim.generalAverageDelta,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 5. Tool: get_grade_requirements (SIMULATE)
  server.tool(
    'get_grade_requirements',
    'Calculate the exact minimum score required on an upcoming assessment to achieve a target quarterly grade in a subject.',
    {
      subjectNameOrId: z.string().describe('Subject name or ID'),
      quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).describe('Grading period'),
      component: z.enum(['WW', 'PT', 'QA']).describe('Component (WW, PT, QA)'),
      targetQuarterlyGrade: z.number().min(60).max(100).describe('Target quarterly grade (e.g. 90, 95)'),
      upcomingAssessmentTotal: z.number().min(1).describe('Total points for the upcoming assessment'),
    },
    async ({ subjectNameOrId, quarter, component, targetQuarterlyGrade, upcomingAssessmentTotal }) => {
      const data = loadData();
      const targetSub = data.subjects.find(
        (s) =>
          s.id.toLowerCase() === subjectNameOrId.toLowerCase() ||
          s.name.toLowerCase().includes(subjectNameOrId.toLowerCase())
      );

      if (!targetSub) {
        return {
          content: [
            {
              type: 'text',
              text: `Subject "${subjectNameOrId}" not found.`,
            },
          ],
        };
      }

      const requirement = calculateRequiredScore(
        targetSub,
        quarter as GradingPeriod,
        component as GradingComponent,
        targetQuarterlyGrade,
        data.assessments,
        upcomingAssessmentTotal
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(requirement, null, 2),
          },
        ],
      };
    }
  );

  // 6. Tool: forecast_general_average (SIMULATE)
  server.tool(
    'forecast_general_average',
    'Generate Conservative, Realistic, and Optimistic forecasting scenarios and calculate minimum future performance for a target general average.',
    {
      targetGeneralAverage: z.number().optional().describe('Optional target general average to solve for (e.g. 90, 95)'),
    },
    async ({ targetGeneralAverage }) => {
      const data = loadData();
      const scenarios = generateStandardScenarios(data.subjects, data.assessments);
      const plan = targetGeneralAverage
        ? calculateMinimumFutureGradesForTargetGA(data.subjects, data.assessments, targetGeneralAverage)
        : null;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                scenarios,
                targetPlan: plan,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 7. Tool: record_score (WRITE)
  server.tool(
    'record_score',
    'Record a new academic score into the user records. (Requires explicit user confirmation).',
    {
      subjectNameOrId: z.string().describe('Subject name or ID'),
      quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).describe('Grading period'),
      component: z.enum(['WW', 'PT', 'QA']).describe('Component (WW, PT, QA)'),
      title: z.string().describe('Assessment title (e.g. Quiz 3, Chapter Test)'),
      score: z.number().describe('Score earned'),
      totalPossible: z.number().describe('Total possible score'),
    },
    async ({ subjectNameOrId, quarter, component, title, score, totalPossible }) => {
      const data = loadData();
      const targetSub = data.subjects.find(
        (s) =>
          s.id.toLowerCase() === subjectNameOrId.toLowerCase() ||
          s.name.toLowerCase().includes(subjectNameOrId.toLowerCase())
      );

      if (!targetSub) {
        return {
          content: [{ type: 'text', text: `Error: Subject "${subjectNameOrId}" not found.` }],
        };
      }

      const newAssessment: Assessment = {
        id: `a_${Date.now()}`,
        subjectId: targetSub.id,
        quarter: quarter as GradingPeriod,
        component: component as GradingComponent,
        title,
        score,
        totalPossible,
        date: new Date().toISOString().split('T')[0],
      };

      data.assessments.push(newAssessment);
      saveData(data);

      const updatedReportCard = calculateEstimatedReportCard(
        data.subjects,
        data.assessments,
        data.futureAssumptions
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'success',
                message: `Recorded ${title} (${score}/${totalPossible}) for ${targetSub.name} in ${quarter}.`,
                newCurrentGeneralAverage: updatedReportCard.currentGeneralAverage,
                newProjectedGeneralAverage: updatedReportCard.projectedGeneralAverage,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

// Stdio server runner when executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const server = createAmplifierMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
}
