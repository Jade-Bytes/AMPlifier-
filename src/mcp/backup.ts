import { normalizeAssessments, normalizeHistoricalGrades, normalizeSchedule, normalizeSettings, normalizeTasks, SUBJECT_COLORS, subjectCode, type WorkspaceSettings } from '../lib/records';
import type { AcademicProfile, Assessment, ClassSession, HistoricalGrade, Subject, Task } from '../types/app';

/** Written by Settings → Data & backup → JSON backup. */
export const BACKUP_FORMAT = 'amplifier-backup';
export const BACKUP_VERSION = 2;

/** One student's records, read from their own backup file. The MCP server never holds anyone else's data. */
export type McpWorkspace = {
  exportedAt: string | null;
  profile: AcademicProfile | null;
  subjects: Subject[];
  assessments: Assessment[];
  historicalGrades: HistoricalGrade[];
  tasks: Task[];
  schedule: ClassSession[];
  settings: WorkspaceSettings;
};

export class BackupError extends Error {}

function normalizeSubjects(raw: unknown): Subject[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item: any, index) => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name || seen.has(name)) return [];
    seen.add(name);
    const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
    return [{
      id: Number(item.id) || index + 1, name,
      code: typeof item.code === 'string' && item.code ? item.code : subjectCode(name),
      color: typeof item.color === 'string' ? item.color : SUBJECT_COLORS[index % SUBJECT_COLORS.length],
      grade: num(item.grade), change: num(item.change), ww: num(item.ww), pt: num(item.pt), exam: num(item.exam),
      hasBaseline: item.hasBaseline === true,
    }];
  });
}

function normalizeProfile(raw: any): AcademicProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const text = (value: unknown) => typeof value === 'string' ? value : '';
  return {
    schoolName: text(raw.schoolName), gradeLevel: text(raw.gradeLevel), section: text(raw.section), academicYear: text(raw.academicYear),
    ...(text(raw.displayName) ? { displayName: raw.displayName } : {}),
    ...(text(raw.username) ? { username: raw.username } : {}),
  };
}

/** Validates a parsed backup and runs every record through the same normalisers the app uses. */
export function parseBackup(raw: unknown): McpWorkspace {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BackupError('The backup file is not a JSON object.');
  const backup = raw as Record<string, unknown>;
  if (backup.format !== BACKUP_FORMAT) throw new BackupError(`Not an AMPlifier backup (expected format "${BACKUP_FORMAT}"). Export one from Settings → Data & backup.`);
  if (backup.version !== BACKUP_VERSION) throw new BackupError(`Unsupported backup version ${String(backup.version)}; this server reads version ${BACKUP_VERSION}. Export a fresh backup from Settings.`);
  const subjects = normalizeSubjects(backup.subjects);
  return {
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : null,
    profile: normalizeProfile(backup.profile),
    subjects,
    assessments: normalizeAssessments(backup.assessments),
    historicalGrades: normalizeHistoricalGrades(backup.historicalGrades),
    tasks: normalizeTasks(backup.tasks),
    schedule: normalizeSchedule(backup.schedule),
    settings: normalizeSettings(backup.settings as Record<string, unknown> | undefined, subjects),
  };
}

export function parseBackupText(text: string): McpWorkspace {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new BackupError('The backup file is not valid JSON.'); }
  return parseBackup(raw);
}
