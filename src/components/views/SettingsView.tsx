import { useState } from 'react';
import { ArrowDown, ArrowUp, Download, LogOut, Play, Plus, Save, Trash2 } from 'lucide-react';
import { Panel, Segmented, Switch } from '../ui/primitives';
import { usePreferences, type MotionPreference, type ThemePreference } from '../../lib/preferences';
import { sound, SOUND_CATEGORIES } from '../../lib/sound';
import { useFeedback } from '../ui/Feedback';
import { COMPONENT_LABELS, COMPONENTS, DEFAULT_GRADING_WEIGHTS, weightsAreValid, weightsTotal } from '../../engine/calculator';
import { buildReportCard } from '../../engine/reportCard';
import type { AcademicModel } from '../../state/useAcademicModel';
import type { Workspace } from '../../state/useWorkspace';
import type { AcademicProfile, GradingScale, GradingWeights, Subject } from '../../types/app';

type Props = { ws: Workspace; model: AcademicModel; email: string; onSignOut: () => void };

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (value: unknown) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const csv = (rows: unknown[][]) => rows.map(row => row.map(csvCell).join(',')).join('\r\n');
const stamp = () => new Date().toISOString().slice(0, 10);

export default function SettingsView({ ws, model, email, onSignOut }: Props) {
  const { notify, confirm } = useFeedback();
  const demo = ws.session?.demo ?? false;

  function exportJson() {
    download(`amplifier-backup-${stamp()}.json`, 'application/json', JSON.stringify({
      format: 'amplifier-backup', version: 2, exportedAt: new Date().toISOString(),
      profile: ws.profile, subjects: ws.subjects, assessments: ws.assessments, historicalGrades: ws.historicalGrades,
      tasks: ws.tasks, schedule: ws.schedule, settings: ws.settings,
    }, null, 2));
    notify('Backup downloaded');
  }

  function exportAssessments() {
    download(`amplifier-assessments-${stamp()}.csv`, 'text/csv', csv([
      ['Period', 'Subject', 'Component', 'Title', 'Score', 'Max score', 'Percent', 'Date'],
      ...ws.assessments.map(item => [item.period, item.subject, COMPONENT_LABELS[item.component], item.title, item.score, item.maxScore, (item.score / item.maxScore * 100).toFixed(2), item.date]),
    ]));
    notify('Assessments exported as CSV');
  }

  function exportReportCard() {
    const rows = buildReportCard({ subjects: ws.subjects, assessments: ws.assessments, historicalGrades: ws.historicalGrades, weights: ws.settings.gradingWeights, futureGrades: ws.settings.futureGrades, options: model.options }, model.termPeriods);
    download(`amplifier-report-card-${stamp()}.csv`, 'text/csv', csv([
      ['Subject', ...model.termPeriods.flatMap(term => [term, `${term} source`])],
      ...rows.map(row => [row.subject.name, ...row.terms.flatMap(entry => entry ? [entry.grade.toFixed(1), entry.source] : ['', ''])]),
    ]));
    notify('Report card exported as CSV');
  }

  return <div className="settings-layout">
    <nav className="settings-nav" aria-label="Settings sections">
      {[['school', 'School'], ['subjects', 'Subjects & weights'], ['grading', 'Grading rules'], ['appearance', 'Appearance'], ['sound', 'Sound'], ['data', 'Data & backup'], ['account', 'Account']].map(([id, label]) =>
        <a key={id} href={`#settings-${id}`} onClick={event => { event.preventDefault(); document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{label}</a>)}
    </nav>
    <div className="view-stack">
      <SchoolSettings ws={ws}/>
      <SubjectSettings ws={ws}/>

      <Panel id="settings-grading" title="Grading rules" description="Applied to every estimate, simulation, and forecast. Recorded scores are never changed.">
        <div className="setting-line">
          <div><b>Grade scale</b><p>How a term grade is derived from weighted component scores.</p></div>
          <Segmented<GradingScale> label="Grade scale" value={ws.settings.gradingScale} onChange={value => { ws.updateSettings({ gradingScale: value }, { immediate: true }); notify(value === 'deped' ? 'DepEd transmutation on · grades recalculated' : 'Percentage grades on · grades recalculated'); }}
            options={[{ value: 'percentage', label: 'Weighted percentage' }, { value: 'deped', label: 'DepEd transmuted' }]}/>
        </div>
        <p className="card-footnote">{ws.settings.gradingScale === 'deped' ? 'Estimated grades use the DepEd Order No. 8, s. 2015 transmutation table: an initial grade of 60 becomes 75, 84 becomes 90, and 100 stays 100. Official report-card grades you enter are shown as typed.' : 'Estimated grades are the weighted percentage of your component scores, without transmutation. Choose DepEd transmuted if your school uses the K to 12 transmutation table.'}</p>
        <div className="setting-line">
          <div><b>Passing grade</b><p>Used for status labels, chart reference lines, and insights.</p></div>
          <input className="input-narrow" type="number" min="1" max="100" step="1" value={ws.settings.passingGrade} aria-label="Passing grade"
            onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value > 0 && value <= 100) ws.updateSettings({ passingGrade: value }); }}/>
        </div>
      </Panel>

      <AppearanceSettings/>
      <SoundSettingsPanel/>

      <Panel id="settings-data" title="Data & backup" description="Download a copy of your records at any time.">
        <div className="setting-line"><div><b>Full backup</b><p>Profile, subjects, scores, report-card grades, tasks, timetable, and settings as JSON.</p></div><button className="btn btn-secondary btn-sm" onClick={exportJson}><Download size={14}/> JSON backup</button></div>
        <div className="setting-line"><div><b>Assessments</b><p>Every recorded score, for spreadsheets.</p></div><button className="btn btn-secondary btn-sm" onClick={exportAssessments} disabled={!ws.assessments.length}><Download size={14}/> CSV</button></div>
        <div className="setting-line"><div><b>Report card</b><p>Term grades with their source (Actual, Estimated, Projected).</p></div><button className="btn btn-secondary btn-sm" onClick={exportReportCard}><Download size={14}/> CSV</button></div>
      </Panel>

      <Panel id="settings-account" title={demo ? 'Preview session' : 'Account'}>
        <div className="setting-line">
          <div><b>{demo ? 'Sample data' : email}</b><p>{demo ? 'Nothing in this preview is saved or connected to an account.' : 'Your workspace is private to this Google account and syncs across devices.'}</p></div>
          <button className="btn btn-secondary btn-sm" onClick={async () => { if (demo || await confirm({ title: 'Sign out of AMPlifier?', confirmLabel: 'Sign out' })) onSignOut(); }}><LogOut size={14}/> {demo ? 'Exit preview' : 'Sign out'}</button>
        </div>
        <p className="card-footnote">AMPlifier · Your academics, amplified. Grades are calculated by a deterministic engine on this device.</p>
      </Panel>
    </div>
  </div>;
}

function SchoolSettings({ ws }: { ws: Workspace }) {
  const { notify } = useFeedback();
  const initial: AcademicProfile = ws.profile ?? { schoolName: '', gradeLevel: '', section: '', academicYear: '' };
  const [draft, setDraft] = useState(initial);
  const dirty = (['schoolName', 'gradeLevel', 'section', 'academicYear'] as const).some(key => (draft[key] ?? '') !== (initial[key] ?? ''));
  const field = (key: 'schoolName' | 'gradeLevel' | 'section' | 'academicYear', label: string, placeholder: string, optional = false) =>
    <label className="field">{label}{optional && <span className="field-optional">Optional</span>}<input value={draft[key] ?? ''} maxLength={80} placeholder={placeholder} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}/></label>;

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.schoolName.trim() || !draft.gradeLevel.trim() || !draft.academicYear.trim()) { notify('School, grade level, and academic year are required', { tone: 'error' }); return; }
    ws.saveProfile({ ...initial, schoolName: draft.schoolName.trim(), gradeLevel: draft.gradeLevel.trim(), section: draft.section.trim(), academicYear: draft.academicYear.trim() });
    notify('School details saved');
  }

  return <Panel id="settings-school" title="School" description={`Shown on your report card. Profile: ${initial.displayName ?? 'Student'}${initial.username ? ` (@${initial.username})` : ''}.`}>
    <form className="form-grid" onSubmit={save}>
      {field('schoolName', 'School', 'School name')}
      {field('gradeLevel', 'Grade level', 'e.g. Grade 9')}
      {field('section', 'Section', 'e.g. Einstein', true)}
      {field('academicYear', 'Academic year', 'e.g. 2026-2027')}
      <div className="field-span-2 form-actions">{dirty && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(initial)}>Discard</button>}<button className="btn btn-primary btn-sm" disabled={!dirty}><Save size={14}/> Save school details</button></div>
    </form>
  </Panel>;
}

function SubjectSettings({ ws }: { ws: Workspace }) {
  const { notify } = useFeedback();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  function add(event: React.FormEvent) {
    event.preventDefault();
    const problem = ws.validateSubjectName(newName);
    if (problem) { setError(problem); return; }
    ws.addSubject(newName);
    notify(`${newName.trim()} added with ${DEFAULT_GRADING_WEIGHTS.ww}/${DEFAULT_GRADING_WEIGHTS.pt}/${DEFAULT_GRADING_WEIGHTS.exam} weights`);
    setNewName(''); setError('');
  }

  return <Panel id="settings-subjects" title="Subjects & weights" description="Each subject has its own Written Works / Performance Tasks / Examination weights, which must total 100%. Renaming a subject updates all of its records.">
    <div className="table-scroll">
      <table className="data-table subject-settings">
        <thead><tr><th scope="col">Color</th><th scope="col">Subject</th>{COMPONENTS.map(component => <th scope="col" key={component} className="num">{COMPONENT_LABELS[component]}</th>)}<th scope="col" className="num">Total</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{ws.subjects.map((subject, index) => <SubjectRow key={subject.id} ws={ws} subject={subject} first={index === 0} last={index === ws.subjects.length - 1}/>)}</tbody>
      </table>
    </div>
    <form className="inline-form" onSubmit={add}>
      <input value={newName} maxLength={40} onChange={event => { setNewName(event.target.value); setError(''); }} placeholder="New subject name" aria-label="New subject name" aria-invalid={Boolean(error)}/>
      <button className="btn btn-secondary btn-sm"><Plus size={14}/> Add subject</button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </form>
  </Panel>;
}

function SubjectRow({ ws, subject, first, last }: { ws: Workspace; subject: Subject; first: boolean; last: boolean }) {
  const { notify, confirm } = useFeedback();
  const saved = ws.settings.gradingWeights[subject.name] ?? DEFAULT_GRADING_WEIGHTS;
  const [name, setName] = useState(subject.name);
  const [color, setColor] = useState(subject.color);
  const [weights, setWeights] = useState<Record<keyof GradingWeights, string>>({ ww: String(saved.ww), pt: String(saved.pt), exam: String(saved.exam) });
  const numeric: GradingWeights = { ww: Number(weights.ww), pt: Number(weights.pt), exam: Number(weights.exam) };
  const total = weightsTotal(numeric);
  const valid = weightsAreValid(numeric);
  const dirty = name.trim() !== subject.name || COMPONENTS.some(key => numeric[key] !== saved[key]);

  function save() {
    if (!valid) { notify(`${subject.name}: weights must total 100%`, { tone: 'error' }); return; }
    const problem = ws.validateSubjectName(name, subject.name);
    if (problem) { notify(problem, { tone: 'error' }); return; }
    ws.updateSubject(subject, { name, weights: numeric });
    notify(name.trim() !== subject.name ? `Renamed to ${name.trim()} · records updated` : `${subject.name} weights saved · grades recalculated`);
  }

  async function remove() {
    const counts = {
      scores: ws.assessments.filter(item => item.subject === subject.name).length,
      grades: ws.historicalGrades.filter(item => item.subject === subject.name).length,
      classes: ws.schedule.filter(item => item.subject === subject.name).length,
    };
    const lost = [counts.scores && `${counts.scores} score${counts.scores === 1 ? '' : 's'}`, counts.grades && `${counts.grades} report-card grade${counts.grades === 1 ? '' : 's'}`, counts.classes && `${counts.classes} timetable class${counts.classes === 1 ? '' : 'es'}`].filter(Boolean).join(', ');
    if (!await confirm({ title: `Remove ${subject.name}?`, destructive: true, confirmLabel: 'Remove subject', message: lost ? `This permanently deletes ${lost}. Tasks and notes are kept. Consider downloading a backup first.` : 'It has no recorded grades. Tasks and notes are kept.' })) return;
    ws.removeSubject(subject);
    notify(`${subject.name} removed`);
  }

  return <tr>
    <td><input type="color" className="color-input" value={color} aria-label={`${subject.name} color`} onChange={event => setColor(event.target.value)} onBlur={() => { if (color !== subject.color) ws.updateSubject(subject, { color }); }}/></td>
    <td><input className="cell-input" value={name} maxLength={40} aria-label={`${subject.name} name`} onChange={event => setName(event.target.value)}/></td>
    {COMPONENTS.map(key => <td key={key} className="num"><input className="cell-input cell-input-num" type="number" min="0" max="100" step="any" value={weights[key]} aria-label={`${subject.name} ${COMPONENT_LABELS[key]} weight`} onChange={event => setWeights(current => ({ ...current, [key]: event.target.value }))}/></td>)}
    <td className={`num ${valid ? '' : 'text-danger'}`}>{Number.isFinite(total) ? `${Number(total.toFixed(2))}%` : '—'}</td>
    <td className="cell-actions">
      {dirty && <button className="btn btn-primary btn-xs" onClick={save} disabled={!valid}>Save</button>}
      <button className="btn-icon" aria-label={`Move ${subject.name} up`} disabled={first} onClick={() => ws.moveSubject(subject, -1)}><ArrowUp size={14}/></button>
      <button className="btn-icon" aria-label={`Move ${subject.name} down`} disabled={last} onClick={() => ws.moveSubject(subject, 1)}><ArrowDown size={14}/></button>
      <button className="btn-icon btn-icon-danger" aria-label={`Remove ${subject.name}`} disabled={ws.subjects.length === 1} onClick={() => void remove()}><Trash2 size={14}/></button>
    </td>
  </tr>;
}

const THEMES: { value: ThemePreference; label: string }[] = [{ value: 'system', label: 'Match system' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }];

function AppearanceSettings() {
  const { prefs, update, play } = usePreferences();
  return <Panel id="settings-appearance" title="Appearance" description="Saved on this device only.">
    <div className="theme-cards" role="group" aria-label="Theme">
      {THEMES.map(theme => <button key={theme.value} type="button" className="theme-card" aria-pressed={prefs.theme === theme.value} onClick={() => { if (prefs.theme !== theme.value) play('tap'); update({ theme: theme.value }); }}>
        <span className={`theme-swatch theme-swatch-${theme.value}`} aria-hidden="true"><i/><i/><i/></span>{theme.label}
      </button>)}
    </div>
    <div className="setting-line">
      <div><b>Motion</b><p>Page transitions, chart reveals, and animated numbers. Reduced keeps every change instant.</p></div>
      <Segmented<MotionPreference> label="Motion" value={prefs.motion} onChange={motion => update({ motion })} options={[{ value: 'system', label: 'System' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }]}/>
    </div>
    <div className={`setting-line ${prefs.motion === 'reduced' ? 'is-disabled' : ''}`}>
      <div><b>Ambient background</b><p>Slowly drifting light behind the app. Turns off automatically with reduced motion.</p></div>
      <Switch label="Ambient background" checked={prefs.ambient} disabled={prefs.motion === 'reduced'} onChange={ambient => update({ ambient })}/>
    </div>
    <div className="setting-line">
      <div><b>Reduce transparency</b><p>Use solid surfaces instead of frosted glass for maximum contrast.</p></div>
      <Switch label="Reduce transparency" checked={prefs.reduceTransparency} onChange={reduceTransparency => update({ reduceTransparency })}/>
    </div>
    <div className="setting-line">
      <div><b>Compact sidebar</b><p>Show navigation as icons only.</p></div>
      <Switch label="Compact sidebar" checked={prefs.sidebarCollapsed} onChange={sidebarCollapsed => update({ sidebarCollapsed })}/>
    </div>
  </Panel>;
}

function SoundSettingsPanel() {
  const { prefs, updateSound } = usePreferences();
  const { enabled, volume, categories } = prefs.sound;
  const percent = Math.round(volume * 100);
  return <Panel id="settings-sound" title="Sound" description="Short, quiet tones for pages, numbers, and actions. Nothing in AMPlifier depends on hearing them.">
    <div className="setting-line">
      <div><b>Interface sounds</b><p>Play sounds on this device.</p></div>
      <Switch label="Interface sounds" checked={enabled} onChange={value => { updateSound({ enabled: value }); if (value) sound.play('toggleOn', { force: true }); }}/>
    </div>
    <div className={`setting-line ${enabled ? '' : 'is-disabled'}`}>
      <div><b>Volume</b><p>Relative to your system volume.</p></div>
      <div className="volume-control">
        <input type="range" min="0" max="100" step="5" value={percent} disabled={!enabled} aria-label="Sound volume" style={{ '--fill': `${percent}%` } as React.CSSProperties}
          onChange={event => updateSound({ volume: Number(event.target.value) / 100 })} onPointerUp={() => sound.play('select')} onKeyUp={() => sound.play('select')}/>
        <output>{percent}%</output>
      </div>
    </div>
    {SOUND_CATEGORIES.map(category => <div className={`setting-line ${enabled ? '' : 'is-disabled'}`} key={category.id}>
      <div><b>{category.label}</b><p>{category.description}</p></div>
      <div className="setting-control">
        <button type="button" className="btn btn-ghost btn-sm" disabled={!enabled} onClick={() => sound.play(category.preview, { force: true })} aria-label={`Preview ${category.label.toLowerCase()} sound`}><Play size={13}/> Preview</button>
        <Switch label={`${category.label} sounds`} checked={categories[category.id]} disabled={!enabled} onChange={value => updateSound({ categories: { ...categories, [category.id]: value } })}/>
      </div>
    </div>)}
  </Panel>;
}
