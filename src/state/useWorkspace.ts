import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { DEFAULT_GRADING_WEIGHTS } from '../engine/calculator';
import { ensureUserDocument, getUserWorkspace, renameSubjectInNotes, saveUserRecords, saveUserSettings, subscribeUserWorkspace, type UserWorkspace, type WorkspacePatch } from '../services/firebase';
import { loadCached, saveCached } from '../lib/localCache';
import { normalizeAssessments, normalizeHistoricalGrades, normalizeSchedule, normalizeSettings, normalizeTasks, removeSubjectFromData, renameSubjectInData, SUBJECT_COLORS, subjectCode, type SubjectLinkedData, type WorkspaceSettings } from '../lib/records';
import type { AcademicProfile, Assessment, ClassSession, GradingWeights, HistoricalGrade, Subject, Task } from '../types/app';
import { buildDemoWorkspace } from './demoData';

export type Session = { uid: string; demo: boolean };
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Notify = (message: string, options?: { tone?: 'success' | 'error' | 'info' }) => void;

const SETTINGS_DEBOUNCE_MS = 600;
const EMPTY_SETTINGS: WorkspaceSettings = normalizeSettings(undefined, []);

export function friendlyError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'Firestore denied access. Deploy the provided Firestore rules and try again.';
  if (code === 'unavailable') return 'You appear to be offline. Changes will sync when the connection returns.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function normalizeSubjects(raw: Subject[]): Subject[] {
  return raw.map(subject => ({ ...subject, hasBaseline: subject.hasBaseline ?? false }));
}

/**
 * Owns the signed-in student's workspace: loading, live sync, local caching and saving.
 * Every mutation updates React state first (instant UI), then the browser cache, then Firestore.
 */
export function useWorkspace(notify: Notify) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [historicalGrades, setHistoricalGrades] = useState<HistoricalGrade[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ClassSession[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings>(EMPTY_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  // Latest records, updated synchronously by every persist call so delayed callbacks (e.g. Undo) never see stale data.
  const data = useRef({ assessments, historicalGrades, tasks, schedule });
  data.current = { assessments, historicalGrades, tasks, schedule };
  const pendingSettings = useRef<Partial<WorkspaceSettings>>({});
  const settingsTimer = useRef<number | undefined>(undefined);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const cloud = session && !session.demo ? session.uid : null;

  const applyWorkspace = useCallback((uid: string, workspace: UserWorkspace) => {
    const subjectList = normalizeSubjects(workspace.subjects);
    const next = {
      assessments: normalizeAssessments(workspace.assessments ?? loadCached(uid, 'assessments', [])),
      tasks: normalizeTasks(workspace.tasks ?? loadCached(uid, 'tasks', [])),
      historicalGrades: normalizeHistoricalGrades(workspace.historicalGrades ?? loadCached(uid, 'historical-grades', [])),
      schedule: normalizeSchedule(workspace.schedule ?? loadCached(uid, 'schedule', [])),
    };
    setProfile(workspace.profile ?? { schoolName: '', gradeLevel: '', section: '', academicYear: '2026-2027' });
    setSubjects(subjectList);
    setAssessments(next.assessments);
    setTasks(next.tasks);
    setHistoricalGrades(next.historicalGrades);
    setSchedule(next.schedule);
    setSettings(normalizeSettings(workspace.settings, subjectList));
    saveCached(uid, 'assessments', next.assessments);
    saveCached(uid, 'tasks', next.tasks);
    saveCached(uid, 'historical-grades', next.historicalGrades);
    saveCached(uid, 'schedule', next.schedule);
    return next;
  }, []);

  /** Loads a signed-in user's workspace. Returns whether first-run setup still has to happen. */
  const hydrate = useCallback(async (user: User): Promise<{ setupCompleted: boolean; needsIdentity: boolean }> => {
    await ensureUserDocument(user);
    const workspace = await getUserWorkspace(user.uid);
    const setupCompleted = workspace.setupCompleted && workspace.subjects.length > 0;
    setSession({ uid: user.uid, demo: false });
    if (!setupCompleted) {
      reset(true);
      setSession({ uid: user.uid, demo: false });
      return { setupCompleted: false, needsIdentity: false };
    }
    const loaded = applyWorkspace(user.uid, workspace);
    // One-time migration: copy browser-only records into Firestore for accounts that predate cloud sync.
    const missing: WorkspacePatch = {
      ...(workspace.assessments === null ? { assessments: loaded.assessments } : {}),
      ...(workspace.tasks === null ? { tasks: loaded.tasks } : {}),
      ...(workspace.historicalGrades === null ? { historicalGrades: loaded.historicalGrades } : {}),
      ...(workspace.schedule === null ? { schedule: loaded.schedule } : {}),
    };
    if (Object.keys(missing).length) await saveUserRecords(user.uid, missing);
    return { setupCompleted: true, needsIdentity: !workspace.profile?.displayName || !workspace.profile?.username };
  }, [applyWorkspace]);

  function reset(keepSession = false) {
    window.clearTimeout(settingsTimer.current);
    pendingSettings.current = {};
    if (!keepSession) setSession(null);
    setProfile(null); setSubjects([]); setAssessments([]); setHistoricalGrades([]); setTasks([]); setSchedule([]);
    setSettings(EMPTY_SETTINGS); setSaveState('idle');
  }

  function loadDemo() {
    const demo = buildDemoWorkspace();
    setSession({ uid: 'amplifier-demo-session', demo: true });
    setProfile(demo.profile); setSubjects(demo.subjects); setAssessments(demo.assessments); setHistoricalGrades(demo.historicalGrades);
    setTasks(demo.tasks); setSchedule(demo.schedule); setSettings(demo.settings); setSaveState('idle');
  }

  // Live sync from other devices. Settings are only replaced when this device has no unsaved edits.
  useEffect(() => {
    if (!cloud) return;
    return subscribeUserWorkspace(cloud, (workspace, local) => {
      if (local || !workspace.setupCompleted) return;
      const subjectList = normalizeSubjects(workspace.subjects);
      if (subjectList.length) setSubjects(current => JSON.stringify(current) === JSON.stringify(subjectList) ? current : subjectList);
      if (workspace.profile) setProfile(current => JSON.stringify(current) === JSON.stringify(workspace.profile) ? current : workspace.profile);
      if (workspace.assessments) { const next = normalizeAssessments(workspace.assessments); setAssessments(next); saveCached(cloud, 'assessments', next); }
      if (workspace.tasks) { const next = normalizeTasks(workspace.tasks); setTasks(next); saveCached(cloud, 'tasks', next); }
      if (workspace.schedule) { const next = normalizeSchedule(workspace.schedule); setSchedule(next); saveCached(cloud, 'schedule', next); }
      if (workspace.historicalGrades) { const next = normalizeHistoricalGrades(workspace.historicalGrades); setHistoricalGrades(next); saveCached(cloud, 'historical-grades', next); }
      if (Object.keys(pendingSettings.current).length === 0) {
        const remote = normalizeSettings(workspace.settings, subjectList.length ? subjectList : []);
        if (JSON.stringify(remote) !== JSON.stringify(settingsRef.current)) setSettings(remote);
      }
    }, error => notifyRef.current(`Cloud sync paused: ${friendlyError(error)}`, { tone: 'error' }));
  }, [cloud]);

  useEffect(() => () => window.clearTimeout(settingsTimer.current), []);

  function writeCloud(patch: WorkspacePatch, failure: string) {
    if (!cloud) return;
    setSaveState('saving');
    saveUserRecords(cloud, patch)
      .then(() => setSaveState('saved'))
      .catch(error => { setSaveState('error'); notifyRef.current(`${failure}: ${friendlyError(error)}`, { tone: 'error' }); });
  }

  function flushSettings() {
    window.clearTimeout(settingsTimer.current);
    const pending = pendingSettings.current;
    if (!cloud || Object.keys(pending).length === 0) return;
    setSaveState('saving');
    saveUserSettings(cloud, pending)
      .then(() => {
        // Keep anything edited while this write was in flight queued for the next flush.
        for (const key of Object.keys(pending) as (keyof WorkspaceSettings)[]) {
          if (pendingSettings.current[key] === pending[key]) delete pendingSettings.current[key];
        }
        setSaveState('saved');
      })
      .catch(error => { setSaveState('error'); notifyRef.current(`Could not save settings: ${friendlyError(error)}`, { tone: 'error' }); });
  }

  /** Updates settings immediately in the UI; saves to the cloud after a short pause (or at once with `immediate`). */
  function updateSettings(patch: Partial<WorkspaceSettings>, { immediate = false } = {}) {
    setSettings(current => ({ ...current, ...patch }));
    if (!cloud) return;
    pendingSettings.current = { ...pendingSettings.current, ...patch };
    window.clearTimeout(settingsTimer.current);
    if (immediate) flushSettings();
    else { setSaveState('saving'); settingsTimer.current = window.setTimeout(flushSettings, SETTINGS_DEBOUNCE_MS); }
  }

  const persistAssessments = (next: Assessment[]) => { data.current.assessments = next; setAssessments(next); if (cloud) { saveCached(cloud, 'assessments', next); writeCloud({ assessments: next }, 'Could not sync grades'); } };
  const persistHistorical = (next: HistoricalGrade[]) => { data.current.historicalGrades = next; setHistoricalGrades(next); if (cloud) { saveCached(cloud, 'historical-grades', next); writeCloud({ historicalGrades: next }, 'Could not sync report-card grades'); } };
  const persistTasks = (next: Task[]) => { data.current.tasks = next; setTasks(next); if (cloud) { saveCached(cloud, 'tasks', next); writeCloud({ tasks: next }, 'Could not sync tasks'); } };
  const persistSchedule = (next: ClassSession[]) => { data.current.schedule = next; setSchedule(next); if (cloud) { saveCached(cloud, 'schedule', next); writeCloud({ schedule: next }, 'Could not sync timetable'); } };

  function saveAssessment(entry: Assessment) {
    const exists = data.current.assessments.some(item => item.id === entry.id);
    persistAssessments(exists ? data.current.assessments.map(item => item.id === entry.id ? entry : item) : [entry, ...data.current.assessments]);
  }
  function deleteAssessment(id: number) { persistAssessments(data.current.assessments.filter(item => item.id !== id)); }
  function restoreAssessment(entry: Assessment) { persistAssessments([entry, ...data.current.assessments.filter(item => item.id !== entry.id)]); }

  /** Sets (or clears, with `grade === null`) the official report-card grade for one subject and term. */
  function setHistoricalGrade(subject: string, period: string, grade: number | null) {
    const existing = data.current.historicalGrades.find(item => item.subject === subject && item.period === period);
    if (grade === null) { if (existing) persistHistorical(data.current.historicalGrades.filter(item => item !== existing)); return; }
    if (existing?.grade === grade) return;
    persistHistorical(existing
      ? data.current.historicalGrades.map(item => item === existing ? { ...item, grade } : item)
      : [...data.current.historicalGrades, { id: Date.now() + Math.floor(Math.random() * 1000), subject, period, grade }]);
  }

  function saveTask(task: Task) {
    const exists = data.current.tasks.some(item => item.id === task.id);
    persistTasks(exists ? data.current.tasks.map(item => item.id === task.id ? task : item) : [task, ...data.current.tasks]);
  }
  function toggleTask(id: number) { persistTasks(data.current.tasks.map(item => item.id === id ? { ...item, done: !item.done } : item)); }
  function deleteTask(id: number) { persistTasks(data.current.tasks.filter(item => item.id !== id)); }
  function restoreTask(task: Task) { persistTasks([task, ...data.current.tasks.filter(item => item.id !== task.id)]); }

  function saveClass(entry: ClassSession) {
    const exists = data.current.schedule.some(item => item.id === entry.id);
    persistSchedule(exists ? data.current.schedule.map(item => item.id === entry.id ? entry : item) : [...data.current.schedule, entry]);
  }
  function deleteClass(id: number) { persistSchedule(data.current.schedule.filter(item => item.id !== id)); }
  function restoreClass(entry: ClassSession) { persistSchedule([...data.current.schedule.filter(item => item.id !== entry.id), entry]); }

  function saveProfile(next: AcademicProfile) {
    setProfile(next);
    writeCloud({ profile: next }, 'Could not save your profile');
  }

  /* Subject management. Subjects are referenced by name, so renames and removals cascade. */

  const linkedData = (): SubjectLinkedData => ({ ...data.current, gradingWeights: settingsRef.current.gradingWeights, futureGrades: settingsRef.current.futureGrades });

  function applyLinkedData(nextSubjects: Subject[], linked: SubjectLinkedData) {
    const { gradingWeights, futureGrades, ...records } = linked;
    data.current = records;
    setSubjects(nextSubjects); setAssessments(records.assessments); setHistoricalGrades(records.historicalGrades); setTasks(records.tasks); setSchedule(records.schedule);
    setSettings(current => ({ ...current, gradingWeights, futureGrades }));
    if (!cloud) return;
    saveCached(cloud, 'assessments', records.assessments); saveCached(cloud, 'historical-grades', records.historicalGrades);
    saveCached(cloud, 'tasks', records.tasks); saveCached(cloud, 'schedule', records.schedule);
    writeCloud({ subjects: nextSubjects, ...records }, 'Could not save subjects');
    pendingSettings.current = { ...pendingSettings.current, gradingWeights, futureGrades };
    flushSettings();
  }

  function validateSubjectName(name: string, ignore?: string): string | null {
    const clean = name.trim();
    if (!clean) return 'Enter a subject name.';
    if (clean.length > 40) return 'Subject names can be up to 40 characters.';
    if (subjects.some(subject => subject.name !== ignore && subject.name.toLowerCase() === clean.toLowerCase())) return `${clean} already exists.`;
    return null;
  }

  function addSubject(name: string, weights: GradingWeights = { ...DEFAULT_GRADING_WEIGHTS }) {
    const clean = name.trim();
    const used = new Set(subjects.map(subject => subject.color));
    const color = SUBJECT_COLORS.find(value => !used.has(value)) ?? SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length];
    const subject: Subject = { id: Math.max(0, ...subjects.map(item => item.id)) + 1, name: clean, code: subjectCode(clean), color, grade: 0, change: 0, ww: 0, pt: 0, exam: 0, hasBaseline: false };
    applyLinkedData([...subjects, subject], { ...linkedData(), gradingWeights: { ...settings.gradingWeights, [clean]: weights } });
  }

  function updateSubject(original: Subject, changes: { name?: string; color?: string; weights?: GradingWeights }) {
    const name = changes.name?.trim() || original.name;
    const renamed = name !== original.name;
    let data = renamed ? renameSubjectInData(linkedData(), original.name, name) : linkedData();
    if (changes.weights) data = { ...data, gradingWeights: { ...data.gradingWeights, [name]: changes.weights } };
    const nextSubjects = subjects.map(subject => subject.id === original.id ? { ...subject, name, code: renamed ? subjectCode(name) : subject.code, color: changes.color ?? subject.color } : subject);
    applyLinkedData(nextSubjects, data);
    if (renamed && cloud) renameSubjectInNotes(cloud, original.name, name).catch(error => notifyRef.current(`Notes kept the old subject name: ${friendlyError(error)}`, { tone: 'error' }));
  }

  function removeSubject(subject: Subject) {
    applyLinkedData(subjects.filter(item => item.id !== subject.id), removeSubjectFromData(linkedData(), subject.name));
  }

  function moveSubject(subject: Subject, direction: -1 | 1) {
    const index = subjects.findIndex(item => item.id === subject.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= subjects.length) return;
    const next = [...subjects];
    [next[index], next[target]] = [next[target], next[index]];
    setSubjects(next);
    writeCloud({ subjects: next }, 'Could not save subject order');
  }

  return {
    session, profile, subjects, assessments, historicalGrades, tasks, schedule, settings, saveState,
    setSession, setProfile, hydrate, reset, loadDemo, applyWorkspace,
    updateSettings, flushSettings,
    saveAssessment, deleteAssessment, restoreAssessment, setHistoricalGrade,
    saveTask, toggleTask, deleteTask, restoreTask,
    saveClass, deleteClass, restoreClass,
    saveProfile, validateSubjectName, addSubject, updateSubject, removeSubject, moveSubject,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
