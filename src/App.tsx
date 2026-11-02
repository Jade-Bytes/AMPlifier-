import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ArrowRight, Plus, Sparkles, Users, X } from 'lucide-react';
import AuthPage from './components/AuthPage';
import AcademicSetupPage from './components/AcademicSetupPage';
import IdentitySetupPage from './components/IdentitySetupPage';
import ReportCardView from './components/ReportCardView';
import ClassScheduleView from './components/ClassScheduleView';
import Sidebar from './components/layout/Sidebar';
import Topbar, { type SearchResult } from './components/layout/Topbar';
import { pageInfo, TOUR_STEPS, type PageId } from './components/layout/navigation';
import { FeedbackProvider, useFeedback } from './components/ui/Feedback';
import { Ambient, ErrorBoundary, LoadedCue, LoadingScreen, SkeletonCard } from './components/ui/Brand';
import { usePointerGlow } from './components/ui/motion';
import { PreferencesProvider, useMediaQuery, usePreferences } from './lib/preferences';
import ScoreDialog from './components/dialogs/ScoreDialog';
import TaskDialog from './components/dialogs/TaskDialog';
import ClassDialog from './components/dialogs/ClassDialog';
import OverviewView from './components/views/OverviewView';
import GradesView from './components/views/GradesView';
import SimulatorView from './components/views/SimulatorView';
import ForecastView from './components/views/ForecastView';
import TasksView from './components/views/TasksView';
import SettingsView from './components/views/SettingsView';
import { firebaseAuth, firebaseConfigured, getUserWorkspace, saveAcademicSetup, saveUsernameProfile, signInWithGoogle, signOutUser } from './services/firebase';
import { useWorkspace, friendlyError } from './state/useWorkspace';
import { useAcademicModel } from './state/useAcademicModel';
import { loadCached, saveCached } from './lib/localCache';
import { daysUntil } from './lib/dates';
import type { AcademicSetup, Assessment, ClassSession, Task } from './types/app';

// Notes (DOCX preview) and Community (social queries) are loaded on first visit to keep startup light.
const NotesView = lazy(() => import('./components/NotesView'));
const SocialHub = lazy(() => import('./components/SocialHub'));

type DialogState =
  | { kind: 'score'; assessment?: Assessment; subject?: string }
  | { kind: 'task'; task?: Task; subject?: string }
  | { kind: 'class'; entry?: ClassSession }
  | null;

function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/unauthorized-domain') return 'This website address is not authorized for sign-in yet. Add it under Firebase Authentication → Settings → Authorized domains.';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'The sign-in window was closed before sign-in finished.';
  if (code === 'auth/network-request-failed') return 'Could not reach Google. Check your connection and try again.';
  return friendlyError(error);
}

export default function App() {
  return <PreferencesProvider><Ambient/><ErrorBoundary><FeedbackProvider><AmplifierApp/></FeedbackProvider></ErrorBoundary></PreferencesProvider>;
}

function AmplifierApp() {
  const { notify } = useFeedback();
  const ws = useWorkspace(notify);
  const model = useAcademicModel(ws);
  const { prefs, update: updatePrefs, play } = usePreferences();
  usePointerGlow();
  // Narrow windows always get the icon rail; the preference applies to wider ones.
  const narrowWindow = useMediaQuery('(max-width: 960px)');
  const railCollapsed = prefs.sidebarCollapsed || narrowWindow;

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState('');

  const [page, setPage] = useState<PageId>('overview');
  const [subject, setSubject] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [tourIndex, setTourIndex] = useState<number | null>(null);

  const demo = ws.session?.demo ?? false;
  const selectedSubject = ws.subjects.some(item => item.name === subject) ? subject : ws.subjects[0]?.name ?? '';

  useEffect(() => {
    if (demo) return;
    if (!firebaseConfigured || !firebaseAuth) { setAuthLoading(false); return; }
    return onAuthStateChanged(firebaseAuth, async user => {
      setAuthLoading(true);
      setAuthError('');
      if (!user) { ws.reset(); setAuthUser(null); setSetupCompleted(false); setNeedsIdentity(false); setAuthLoading(false); return; }
      try {
        const result = await ws.hydrate(user);
        setSetupCompleted(result.setupCompleted);
        setNeedsIdentity(result.needsIdentity);
        setAuthUser(user);
        if (result.setupCompleted && !result.needsIdentity && !loadCached(user.uid, 'tutorial-seen', false)) setTourIndex(0);
      } catch (error) {
        setAuthUser(null);
        setAuthError(authErrorMessage(error));
      } finally {
        setAuthLoading(false);
      }
    });
    // ws.hydrate/reset are stable for the lifetime of the hook.
  }, [demo]);

  function navigate(next: PageId) {
    if (next !== page) play('navigate');
    setPage(next);
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function openSubject(name: string, target: PageId = 'grades') {
    setSubject(name);
    navigate(target);
  }

  function enterDemo() {
    ws.loadDemo();
    setAuthUser({ uid: 'amplifier-demo-session', displayName: 'Demo Student', email: 'demo@example.test', photoURL: null } as User);
    setSetupCompleted(true);
    setNeedsIdentity(false);
    setAuthLoading(false);
    setPage('overview');
    setTourIndex(0);
  }

  function exitDemo() {
    ws.reset();
    setAuthUser(null);
    setSetupCompleted(false);
    setPage('overview');
    setTourIndex(null);
  }

  async function signIn() {
    setAuthBusy(true);
    setAuthError('');
    try { await signInWithGoogle(); }
    catch (error) { setAuthError(authErrorMessage(error)); }
    finally { setAuthBusy(false); }
  }

  async function signOut() {
    if (demo) { exitDemo(); return; }
    ws.flushSettings();
    try { await signOutUser(); } catch (error) { notify(authErrorMessage(error), { tone: 'error' }); }
  }

  async function completeSetup(setup: AcademicSetup) {
    if (!authUser) return;
    setSetupSaving(true);
    setSetupError('');
    try {
      await saveAcademicSetup(authUser.uid, setup);
      ws.applyWorkspace(authUser.uid, await getUserWorkspace(authUser.uid));
      setSetupCompleted(true);
      setNeedsIdentity(false);
      setPage('overview');
      setTourIndex(0);
    } catch (error) {
      setSetupError(authErrorMessage(error));
    } finally {
      setSetupSaving(false);
    }
  }

  async function completeIdentity(displayName: string, username: string) {
    if (!authUser || !ws.profile) return;
    setSetupSaving(true);
    setSetupError('');
    try {
      await saveUsernameProfile(authUser.uid, displayName, username);
      ws.setProfile({ ...ws.profile, displayName, username });
      setNeedsIdentity(false);
      setPage('overview');
      if (!loadCached(authUser.uid, 'tutorial-seen', false)) setTourIndex(0);
    } catch (error) {
      setSetupError(authErrorMessage(error));
    } finally {
      setSetupSaving(false);
    }
  }

  function changePeriod(period: string) {
    ws.updateSettings({ period }, { immediate: true });
  }

  function deleteAssessment(assessment: Assessment) {
    ws.deleteAssessment(assessment.id);
    notify(`Deleted “${assessment.title}” · grades recalculated`, { tone: 'info', action: { label: 'Undo', run: () => ws.restoreAssessment(assessment) } });
  }

  function deleteTask(task: Task) {
    ws.deleteTask(task.id);
    notify(`Deleted “${task.title}”`, { tone: 'info', action: { label: 'Undo', run: () => ws.restoreTask(task) } });
  }

  function deleteClass(entry: ClassSession) {
    ws.deleteClass(entry.id);
    notify(`Removed ${entry.subject} from your timetable`, { tone: 'info', action: { label: 'Undo', run: () => ws.restoreClass(entry) } });
  }

  function onSearch(result: SearchResult) {
    if (result.kind === 'page') navigate(result.page);
    else if (result.kind === 'subject') openSubject(result.subject.name);
    else if (result.kind === 'assessment') { if (result.assessment.period !== model.period) changePeriod(result.assessment.period); openSubject(result.assessment.subject); setDialog({ kind: 'score', assessment: result.assessment }); }
    else { navigate('tasks'); setDialog({ kind: 'task', task: result.task }); }
  }

  function closeTour() {
    setTourIndex(null);
    if (authUser && !demo) saveCached(authUser.uid, 'tutorial-seen', true);
  }

  function moveTour(step: number) {
    const next = Math.max(0, Math.min(TOUR_STEPS.length - 1, step));
    setTourIndex(next);
    setPage(TOUR_STEPS[next].page);
  }

  useEffect(() => { if (tourIndex !== null) setPage(TOUR_STEPS[tourIndex].page); }, [tourIndex]);

  // The tour panel opening, and the workspace becoming ready after sign-in, setup, or the preview, get a cue.
  const workspaceReady = Boolean(authUser) && setupCompleted && !needsIdentity && !authLoading;
  const readyAt = useRef(0);
  useEffect(() => { if (workspaceReady) { readyAt.current = performance.now(); play('load'); } }, [workspaceReady, play]);
  // The tour that opens by itself on arrival stays quiet (the arrival already has a cue); opening it later does not.
  const tourOpen = tourIndex !== null;
  useEffect(() => { if (tourOpen && performance.now() - readyAt.current > 1500) play('open'); }, [tourOpen, play]);

  if (authLoading) return <LoadingScreen message="Loading your academic workspace…"/>;
  if (!authUser) return <AuthPage configured={firebaseConfigured} loading={authBusy} error={authError} onGoogleSignIn={signIn} onDemoPreview={enterDemo} showDemoPreview={import.meta.env.DEV}/>;
  if (!setupCompleted) return <AcademicSetupPage userName={authUser.displayName ?? ''} saving={setupSaving} error={setupError} onComplete={completeSetup}/>;
  if (needsIdentity && ws.profile) return <IdentitySetupPage initialDisplayName={ws.profile.displayName ?? authUser.displayName ?? ''} initialUsername={ws.profile.username ?? ''} saving={setupSaving} error={setupError} onComplete={completeIdentity}/>;

  const displayName = ws.profile?.displayName || authUser.displayName || 'Student';
  const info = pageInfo(page);
  const openTasks = ws.tasks.filter(task => !task.done).length;
  const urgent = model.upcoming.filter(item => item.source === 'Task' && daysUntil(item.date) <= 2).length;
  const primaryAction = page === 'tasks' ? { label: 'Add task', run: () => setDialog({ kind: 'task' }) }
    : page === 'schedule' ? { label: 'Add class', run: () => setDialog({ kind: 'class' }) }
    : page === 'notes' || page === 'community' || page === 'settings' ? null
    : { label: 'Record score', run: () => setDialog({ kind: 'score', subject: page === 'grades' || page === 'simulator' ? selectedSubject : undefined }) };
  const tourStep = tourIndex === null ? null : TOUR_STEPS[tourIndex];

  return <div className="app-shell" data-sidebar={railCollapsed ? 'collapsed' : 'expanded'}>
    <a className="skip-link" href="#main">Skip to content</a>
    <Sidebar page={page} onNavigate={navigate} profile={ws.profile} displayName={displayName} handle={ws.profile?.username ?? ''} photoURL={authUser.photoURL} openTasks={openTasks} overdueTasks={ws.tasks.filter(task => !task.done && task.dueDate && daysUntil(task.dueDate) < 0).length} onOpenTour={() => moveTour(0)} collapsed={railCollapsed} onToggleCollapsed={() => updatePrefs({ sidebarCollapsed: !prefs.sidebarCollapsed })}/>
    <div className="app-main">
      <Topbar subjects={ws.subjects} assessments={ws.assessments} tasks={ws.tasks} period={model.period} onPeriodChange={changePeriod} saveState={ws.saveState} demo={demo} attentionCount={urgent} onOpenDeadlines={() => navigate('tasks')} onSelect={onSearch}/>
      {demo && <div className="demo-banner" role="status"><Sparkles size={15}/><span><b>Developer preview.</b> Sample data only — changes disappear when you exit.</span><button className="btn btn-ghost btn-sm" onClick={exitDemo}>Exit preview</button></div>}
      <main className="page" id="main" tabIndex={-1}>
        <div className="page-body" key={page}>
        <header className="page-header">
          <div>
            <h1>{page === 'overview' ? `Welcome back, ${displayName.split(' ')[0]}` : info.label}</h1>
            <p>{page === 'overview' ? [ws.profile?.schoolName, ws.profile?.gradeLevel, model.period].filter(Boolean).join(' · ') : info.description}</p>
          </div>
          {primaryAction && ws.subjects.length > 0 && <button className="btn btn-primary" onClick={primaryAction.run}><Plus size={16}/> {primaryAction.label}</button>}
        </header>

        {page === 'overview' && <OverviewView ws={ws} model={model} navigate={navigate} openSubject={openSubject} openScore={() => setDialog({ kind: 'score' })} openTask={() => setDialog({ kind: 'task' })}/>}
        {page === 'grades' && <GradesView ws={ws} model={model} selected={selectedSubject} onSelect={setSubject} openScore={name => setDialog({ kind: 'score', subject: name })} editAssessment={assessment => setDialog({ kind: 'score', assessment })} deleteAssessment={deleteAssessment}/>}
        {page === 'report' && <ReportCardView profile={ws.profile} terms={model.termPeriods} rows={model.rows} passingGrade={ws.settings.passingGrade} gradingScale={ws.settings.gradingScale} yearToDate={model.yearToDate} onGoToGrades={() => navigate('grades')}/>}
        {page === 'simulator' && <SimulatorView ws={ws} model={model} subject={selectedSubject} onSubjectChange={setSubject}/>}
        {page === 'forecast' && <ForecastView ws={ws} model={model} navigate={navigate}/>}
        {page === 'tasks' && <TasksView ws={ws} openTask={task => setDialog({ kind: 'task', task })} deleteTask={deleteTask}/>}
        {page === 'schedule' && <ClassScheduleView sessions={ws.schedule} subjects={ws.subjects} upcoming={model.upcoming} onAdd={() => setDialog({ kind: 'class' })} onEdit={entry => setDialog({ kind: 'class', entry })} onDelete={deleteClass}/>}
        <Suspense fallback={<SkeletonCard/>}>
        {page === 'notes' && <NotesView uid={authUser.uid} subjects={ws.subjects.map(item => item.name)} academicYear={ws.profile?.academicYear ?? '2026-2027'} currentPeriod={model.period} demo={demo}/>}
        {page === 'community' && (demo
          ? <section className="card"><div className="empty-state"><span className="empty-state-icon"><Users size={20}/></span><b>Community needs an account</b><p>Sign in with Google to use chats and groups. The preview stays offline so it cannot create test profiles or messages.</p></div></section>
          : <SocialHub user={authUser} displayName={displayName} username={ws.profile?.username ?? ''}/>)}
        {(page === 'notes' || page === 'community') && <LoadedCue key={page}/>}
        </Suspense>
        {page === 'settings' && <SettingsView ws={ws} model={model} email={authUser.email ?? ''} onSignOut={() => void signOut()}/>}
        </div>
      </main>
    </div>

    {dialog?.kind === 'score' && <ScoreDialog ws={ws} assessment={dialog.assessment} subject={dialog.subject} onClose={() => setDialog(null)}/>}
    {dialog?.kind === 'task' && <TaskDialog ws={ws} task={dialog.task} subject={dialog.subject} onClose={() => setDialog(null)}/>}
    {dialog?.kind === 'class' && <ClassDialog ws={ws} entry={dialog.entry} onClose={() => setDialog(null)}/>}

    {tourStep && tourIndex !== null && <section className="tour glass-float" role="dialog" aria-modal="false" aria-labelledby="tour-title">
      <header><span>Step {tourIndex + 1} of {TOUR_STEPS.length}</span><button className="btn-icon" onClick={closeTour} aria-label="Close tour"><X size={16}/></button></header>
      <div className="tour-progress" aria-hidden="true">{TOUR_STEPS.map((step, index) => <i key={step.page} className={index <= tourIndex ? 'is-done' : ''}/>)}</div>
      <h2 id="tour-title">{tourStep.title}</h2>
      <p>{tourStep.body}</p>
      <footer>
        <button className="btn btn-ghost btn-sm" onClick={closeTour}>Skip tour</button>
        <span>
          <button className="btn btn-secondary btn-sm" disabled={tourIndex === 0} onClick={() => moveTour(tourIndex - 1)} data-sound="select">Back</button>
          <button className="btn btn-primary btn-sm" data-sound={tourIndex === TOUR_STEPS.length - 1 ? 'complete' : 'select'} onClick={() => tourIndex === TOUR_STEPS.length - 1 ? closeTour() : moveTour(tourIndex + 1)}>{tourIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={14}/></button>
        </span>
      </footer>
    </section>}
  </div>;
}
