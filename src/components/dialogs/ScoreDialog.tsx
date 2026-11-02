import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Dialog from '../ui/Dialog';
import { useFeedback } from '../ui/Feedback';
import { Segmented, fmtGrade } from '../ui/primitives';
import { calculateSubjectGrade, COMPONENT_LABELS } from '../../engine/calculator';
import { PERIODS } from '../../engine/periods';
import { todayISO, toISODate } from '../../lib/dates';
import type { Workspace } from '../../state/useWorkspace';
import type { Assessment, GradeComponent } from '../../types/app';

type Props = { ws: Workspace; assessment?: Assessment; subject?: string; onClose: () => void };

const componentOptions = (['ww', 'pt', 'exam'] as GradeComponent[]).map(value => ({ value, label: COMPONENT_LABELS[value] }));

export default function ScoreDialog({ ws, assessment, subject: presetSubject, onClose }: Props) {
  const { notify } = useFeedback();
  const editing = Boolean(assessment);
  const [subject, setSubject] = useState(assessment?.subject ?? presetSubject ?? ws.subjects[0]?.name ?? '');
  const [component, setComponent] = useState<GradeComponent>(assessment?.component ?? 'ww');
  const [score, setScore] = useState(assessment ? String(assessment.score) : '');
  const [maxScore, setMaxScore] = useState(assessment ? String(assessment.maxScore) : '');
  const [title, setTitle] = useState(assessment?.title ?? '');
  const [date, setDate] = useState(assessment ? toISODate(assessment.date) : todayISO());
  const [period, setPeriod] = useState(assessment?.period ?? ws.settings.period);
  const [touched, setTouched] = useState(false);
  const [maxEdited, setMaxEdited] = useState(editing);

  // Suggest the out-of value used last time for this subject and component.
  const suggestedMax = useMemo(() => ws.assessments.find(item => item.subject === subject && item.component === component)?.maxScore, [ws.assessments, subject, component]);
  const effectiveMax = !maxEdited && maxScore === '' && suggestedMax ? String(suggestedMax) : maxScore;

  const numericScore = Number(score);
  const numericMax = Number(effectiveMax);
  const error = score === '' || effectiveMax === '' ? 'Enter the score and the maximum possible score.'
    : !Number.isFinite(numericMax) || numericMax <= 0 ? 'The maximum score must be greater than zero.'
    : !Number.isFinite(numericScore) || numericScore < 0 ? 'The score cannot be negative.'
    : numericScore > numericMax ? 'The score cannot be higher than the maximum score.'
    : !date ? 'Choose the assessment date.'
    : !subject ? 'Choose a subject.' : '';

  const base = ws.subjects.find(item => item.name === subject);
  const options = { scale: ws.settings.gradingScale };
  const preview = useMemo(() => {
    if (!base || error) return null;
    const others = ws.assessments.filter(item => item.id !== assessment?.id);
    const draft: Assessment = { id: -1, subject, component, title, score: numericScore, maxScore: numericMax, date, period };
    const before = calculateSubjectGrade(base, ws.assessments, ws.settings.gradingWeights, period, options);
    const after = calculateSubjectGrade(base, [...others, draft], ws.settings.gradingWeights, period, options);
    return { before: before.hasGrades ? before.grade : null, after: after.grade };
  }, [base, error, ws.assessments, ws.settings, subject, component, numericScore, numericMax, period, date, title, assessment?.id]);

  function save(addAnother: boolean) {
    setTouched(true);
    if (error) return;
    const entry: Assessment = { id: assessment?.id ?? Date.now(), subject, component, title: title.trim() || `${COMPONENT_LABELS[component]} assessment`, score: numericScore, maxScore: numericMax, date, period };
    ws.saveAssessment(entry);
    notify(editing ? 'Assessment updated · grades recalculated' : `Saved ${entry.title} · ${subject} is now ${fmtGrade(preview?.after)}`, { sound: editing ? 'save' : 'success' });
    if (addAnother) { setScore(''); setTitle(''); setTouched(false); document.getElementById('score-input')?.focus(); }
    else onClose();
  }

  const percent = !error ? numericScore / numericMax * 100 : null;
  // Range problems are shown as soon as both numbers are typed; "missing value" waits for a save attempt.
  const showError = Boolean(error) && (touched || (score !== '' && effectiveMax !== ''));

  return <Dialog title={editing ? 'Edit assessment' : 'Record a score'} eyebrow="Gradebook" onClose={onClose} footer={<>
    {!editing && <button type="button" className="btn btn-secondary" onClick={() => save(true)}>Save & add another</button>}
    <button type="submit" form="score-form" className="btn btn-primary">{editing ? 'Save changes' : 'Save score'} <ArrowRight size={15}/></button>
  </>}>
    <form id="score-form" className="form-grid" onSubmit={event => { event.preventDefault(); save(false); }} noValidate>
      <label className="field field-span-2">Subject
        <select value={subject} onChange={event => setSubject(event.target.value)}>{ws.subjects.map(item => <option key={item.id}>{item.name}</option>)}</select>
      </label>
      <div className="field field-span-2"><span className="field-label">Grading component</span>
        <Segmented label="Grading component" value={component} options={componentOptions} onChange={setComponent}/>
      </div>
      <label className="field">Score
        <input id="score-input" data-autofocus inputMode="decimal" type="number" min="0" step="any" value={score} onChange={event => setScore(event.target.value)} aria-invalid={showError} placeholder="e.g. 18"/>
      </label>
      <label className="field">Out of
        <input inputMode="decimal" type="number" min="0" step="any" value={effectiveMax} onChange={event => { setMaxEdited(true); setMaxScore(event.target.value); }} placeholder="e.g. 20"/>
        {!maxEdited && suggestedMax && maxScore === '' && <small className="field-hint">Same as your last {COMPONENT_LABELS[component].toLowerCase()} entry</small>}
      </label>
      <label className="field field-span-2">Assessment name <span className="field-optional">Optional</span>
        <input value={title} maxLength={80} onChange={event => setTitle(event.target.value)} placeholder="e.g. Chapter 3 quiz"/>
      </label>
      <label className="field">Date
        <input type="date" value={date} onChange={event => setDate(event.target.value)}/>
      </label>
      <label className="field">Grading period
        <select value={period} onChange={event => setPeriod(event.target.value)}>{PERIODS.map(value => <option key={value}>{value}</option>)}</select>
      </label>
      <div className="field-span-2 score-preview" aria-live="polite">
        {preview ? <>
          <span>{percent!.toFixed(1)}% on this assessment</span>
          <span>{subject} · {period}: <b>{fmtGrade(preview.before)}</b> → <b className="text-accent">{fmtGrade(preview.after)}</b> <small>estimated</small></span>
        </> : <span className={showError ? 'text-danger' : 'text-muted'} role={showError ? 'alert' : undefined}>{showError ? error : 'Enter a score to preview its effect on your grade.'}</span>}
      </div>
    </form>
  </Dialog>;
}
