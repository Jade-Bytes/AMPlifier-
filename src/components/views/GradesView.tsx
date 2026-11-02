import { useMemo, useState } from 'react';
import { ClipboardList, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Delta, EmptyState, Panel, SourceBadge, SubjectDot, fmtGrade, useSvgId } from '../ui/primitives';
import { AnimatedNumber, useRevealCue } from '../ui/motion';
import { AreaFade } from '../charts/ChartParts';
import { useReducedMotion } from '../../lib/preferences';
import { chart, gradeDomain, gradeTicks } from '../charts/chartTheme';
import { calculateSubjectGrade, COMPONENT_LABELS, COMPONENT_SHORT, COMPONENTS, DEFAULT_GRADING_WEIGHTS, scoreAsPercent } from '../../engine/calculator';
import { parseGradeInput } from '../../engine/reportCard';
import { shortPeriod } from '../../engine/periods';
import { formatDate, toISODate } from '../../lib/dates';
import type { AcademicModel } from '../../state/useAcademicModel';
import type { Workspace } from '../../state/useWorkspace';
import type { Assessment, GradeComponent } from '../../types/app';

type Props = {
  ws: Workspace;
  model: AcademicModel;
  selected: string;
  onSelect: (subject: string) => void;
  openScore: (subject?: string) => void;
  editAssessment: (assessment: Assessment) => void;
  deleteAssessment: (assessment: Assessment) => void;
};

export default function GradesView({ ws, model, selected, onSelect, openScore, editAssessment, deleteAssessment }: Props) {
  const passing = ws.settings.passingGrade;
  const reduced = useReducedMotion();
  useRevealCue();
  const fadeId = useSvgId('grade-fade');
  const subject = model.current.find(item => item.name === selected) ?? model.current[0];
  const base = ws.subjects.find(item => item.name === subject?.name);
  const weights = (subject && ws.settings.gradingWeights[subject.name]) ?? DEFAULT_GRADING_WEIGHTS;

  const periodRecords = useMemo(() => ws.assessments
    .filter(item => item.period === model.period)
    .sort((a, b) => toISODate(b.date).localeCompare(toISODate(a.date)) || b.id - a.id), [ws.assessments, model.period]);

  const timeline = useMemo(() => {
    if (!base) return [];
    const ordered = periodRecords.filter(item => item.subject === base.name).reverse();
    return ordered.map((item, index) => ({
      label: formatDate(toISODate(item.date), { month: 'short', day: 'numeric' }),
      title: item.title, score: `${item.score}/${item.maxScore}`, component: COMPONENT_LABELS[item.component],
      grade: calculateSubjectGrade(base, ordered.slice(0, index + 1), ws.settings.gradingWeights, model.period, model.options).grade,
    }));
  }, [base, periodRecords, ws.settings.gradingWeights, model.period, model.options]);

  const [filterSubject, setFilterSubject] = useState<string>('selected');
  const [filterComponent, setFilterComponent] = useState<GradeComponent | 'all'>('all');
  const [search, setSearch] = useState('');
  const shownSubject = filterSubject === 'selected' ? subject?.name : filterSubject === 'all' ? null : filterSubject;
  const records = periodRecords.filter(item => (!shownSubject || item.subject === shownSubject) && (filterComponent === 'all' || item.component === filterComponent) && (!search.trim() || item.title.toLowerCase().includes(search.trim().toLowerCase())));
  const counts = (name: string, component: GradeComponent) => periodRecords.filter(item => item.subject === name && item.component === component).length;

  return <div className="view-stack">
    <Panel title={`Subjects · ${model.period}`} description="Estimated grades from the scores you record. Select a subject for its breakdown.">
      <div className="table-scroll">
        <table className="data-table subjects-table">
          <thead><tr><th scope="col">Subject</th><th scope="col" className="num">WW</th><th scope="col" className="num">PT</th><th scope="col" className="num">Exam</th><th scope="col" className="num">Grade</th><th scope="col" className="num">vs prev.</th><th scope="col">Status</th></tr></thead>
          <tbody>{model.current.map(item => {
            const w = ws.settings.gradingWeights[item.name] ?? DEFAULT_GRADING_WEIGHTS;
            const status = !item.hasGrades ? 'none' : item.grade < passing ? 'below' : model.target !== null && item.grade < model.target ? 'under-target' : 'ok';
            return <tr key={item.id} className={`is-clickable ${item.name === subject?.name ? 'is-selected' : ''}`} onClick={() => onSelect(item.name)}>
              <th scope="row"><button className="row-button" onClick={event => { event.stopPropagation(); onSelect(item.name); }} aria-pressed={item.name === subject?.name}><SubjectDot color={item.color}/><span>{item.name}<small>{w.ww}/{w.pt}/{w.exam}</small></span></button></th>
              {COMPONENTS.map(component => <td key={component} className="num">{item[`${component}HasGrades`] ? item[component].toFixed(1) : <span className="text-faint">—</span>}</td>)}
              <td className="num"><strong>{item.hasGrades ? item.grade.toFixed(1) : <span className="text-faint">—</span>}</strong></td>
              <td className="num"><Delta value={model.changes[item.name]}/></td>
              <td>{status === 'none' ? <span className="status status-none">No scores</span> : status === 'below' ? <span className="status status-bad">Below {passing}</span> : status === 'under-target' ? <span className="status status-warn">Under target</span> : <span className="status status-ok">On track</span>}</td>
            </tr>;
          })}</tbody>
          <tfoot><tr><th scope="row">Average</th><td colSpan={3}/><td className="num"><strong>{fmtGrade(model.currentAverage)}</strong></td><td colSpan={2} className="text-muted small">{model.graded.length} of {model.current.length} subjects with scores</td></tr></tfoot>
        </table>
      </div>
    </Panel>

    {subject && base && <div className="grid-side-main">
      <Panel title={<><SubjectDot color={subject.color} size={10}/> {subject.name}</>} description={`${model.period} breakdown · ${subject.hasGrades ? 'estimated' : 'no scores yet'}`}>
        <div className="breakdown-total"><span className="breakdown-grade"><AnimatedNumber value={subject.hasGrades ? subject.grade : null} audible/></span>{subject.hasGrades && <SourceBadge source="Estimated"/>}</div>
        <ul className="component-list">
          {COMPONENTS.map(component => {
            const has = subject[`${component}HasGrades`];
            return <li key={component}>
              <div className="component-row"><span>{COMPONENT_LABELS[component]}</span><span className="text-muted small">{weights[component]}% weight · {counts(subject.name, component)} recorded</span><b>{has ? `${subject[component].toFixed(1)}%` : '—'}</b></div>
              <div className="meter" aria-hidden="true"><i style={{ width: `${has ? subject[component] : 0}%` }}/><span className="meter-mark" style={{ left: `${passing}%` }}/></div>
            </li>;
          })}
        </ul>
        {!COMPONENTS.every(component => subject[`${component}HasGrades`]) && subject.hasGrades && <p className="card-footnote">Components without scores are left out and the remaining weights are scaled up until they have scores.</p>}
        <div className="card-inline-actions"><button className="btn btn-secondary btn-sm" onClick={() => openScore(subject.name)}><Plus size={14}/> Score for {subject.name}</button></div>
      </Panel>
      <Panel title="Grade after each assessment" description={`${subject.name} · ${model.period}, in date order`}>
        {timeline.length === 0 ? <EmptyState icon={<ClipboardList size={20}/>} title="No scores this period">Record scores for {subject.name} to see how each one moved your grade.</EmptyState> :
          <div className="chart-box chart-glow" role="img" aria-label={`${subject.name} grade after each assessment: ${timeline.map(point => `${point.title} ${point.grade.toFixed(1)}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeline} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                <defs><AreaFade id={fadeId} color="var(--signal)"/></defs>
                <CartesianGrid vertical={false} stroke={chart.grid}/>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chart.tick} dy={6}/>
                <YAxis domain={gradeDomain(timeline.map(point => point.grade), passing)} ticks={gradeTicks(gradeDomain(timeline.map(point => point.grade), passing))} axisLine={false} tickLine={false} tick={chart.tick} width={40}/>
                <ReferenceLine y={passing} stroke={chart.passing} strokeOpacity={0.45} strokeDasharray="2 4"/>
                <Tooltip cursor={{ stroke: chart.axis, strokeDasharray: '3 4' }} content={({ active, payload }: any) => active && payload?.length ? <div className="chart-tooltip glass-float"><b>{payload[0].payload.title}</b><span>{payload[0].payload.component} · {payload[0].payload.score}</span><span className="chart-tooltip-row"><i style={{ background: 'var(--signal)' }}/>Grade after<strong>{Number(payload[0].payload.grade).toFixed(1)}</strong></span></div> : null}/>
                <Area type="monotone" dataKey="grade" stroke="none" fill={`url(#${fadeId})`} isAnimationActive={!reduced} {...chart.animation} tooltipType="none"/>
                <Line type="monotone" dataKey="grade" stroke={chart.recorded} strokeWidth={2.75} dot={{ r: 4, fill: chart.dotFill, stroke: chart.recorded, strokeWidth: 2 }} activeDot={{ r: 6, fill: chart.recorded, stroke: chart.dotFill, strokeWidth: 2 }} isAnimationActive={!reduced} {...chart.animation}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>}
      </Panel>
    </div>}

    <Panel title="Assessment records" description={`Scores recorded for ${model.period}. Edits recalculate grades immediately.`}>
      <div className="toolbar">
        <label className="input-icon"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search titles" aria-label="Search assessment titles"/></label>
        <select aria-label="Filter by subject" value={filterSubject} onChange={event => setFilterSubject(event.target.value)}>
          <option value="selected">{subject ? `${subject.name} (selected)` : 'Selected subject'}</option><option value="all">All subjects</option>
          {ws.subjects.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
        <select aria-label="Filter by component" value={filterComponent} onChange={event => setFilterComponent(event.target.value as GradeComponent | 'all')}>
          <option value="all">All components</option>{COMPONENTS.map(component => <option key={component} value={component}>{COMPONENT_LABELS[component]}</option>)}
        </select>
        <span className="toolbar-count">{records.length} record{records.length === 1 ? '' : 's'}</span>
      </div>
      {records.length === 0 ? <EmptyState title="No matching records" action={<button className="btn btn-secondary btn-sm" onClick={() => openScore(shownSubject ?? undefined)}><Plus size={14}/> Record a score</button>}>{periodRecords.length ? 'Try another filter.' : `Nothing recorded for ${model.period} yet.`}</EmptyState> :
        <div className="table-scroll"><table className="data-table records-table">
          <thead><tr><th scope="col">Assessment</th><th scope="col">Subject</th><th scope="col">Component</th><th scope="col" className="num">Score</th><th scope="col" className="num">%</th><th scope="col">Date</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{records.map(item => {
            const percent = scoreAsPercent(item.score, item.maxScore);
            return <tr key={item.id}>
              <th scope="row" className="cell-title">{item.title}</th>
              <td><SubjectDot color={ws.subjects.find(s => s.name === item.subject)?.color ?? 'var(--text-faint)'}/> {item.subject}</td>
              <td><span className="chip">{COMPONENT_SHORT[item.component]}</span></td>
              <td className="num">{item.score} / {item.maxScore}</td>
              <td className={`num ${percent < passing ? 'text-danger' : ''}`}>{percent.toFixed(0)}%</td>
              <td className="text-muted">{formatDate(toISODate(item.date), { month: 'short', day: 'numeric' })}</td>
              <td className="cell-actions">
                <button className="btn-icon" aria-label={`Edit ${item.title}`} title="Edit" onClick={() => editAssessment(item)}><Pencil size={14}/></button>
                <button className="btn-icon btn-icon-danger" aria-label={`Delete ${item.title}`} title="Delete" onClick={() => deleteAssessment(item)}><Trash2 size={14}/></button>
              </td>
            </tr>;
          })}</tbody>
        </table></div>}
    </Panel>

    <ReportCardGrid ws={ws} model={model}/>
  </div>;
}

/** Spreadsheet-style entry for official report-card grades (Actual). Saves each cell on blur or Enter. */
function ReportCardGrid({ ws, model }: { ws: Workspace; model: AcademicModel }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const key = (subject: string, term: string) => `${subject}::${term}`;
  const stored = (subject: string, term: string) => ws.historicalGrades.find(item => item.subject === subject && item.period === term)?.grade;

  function commit(subject: string, term: string) {
    const id = key(subject, term);
    if (!(id in drafts)) return;
    const raw = drafts[id].trim();
    const value = parseGradeInput(raw);
    if (raw !== '' && value === null) return; // keep the invalid draft visible
    ws.setHistoricalGrade(subject, term, raw === '' ? null : value);
    setDrafts(current => { const { [id]: _, ...rest } = current; return rest; });
  }

  return <Panel title="Official report-card grades" description="Type the grade printed on your report card for each finished term. These are kept separate from assessment scores, labeled Actual, and take precedence over estimates.">
    <div className="table-scroll">
      <table className="data-table grade-grid">
        <thead><tr><th scope="col">Subject</th>{model.termPeriods.map(term => <th scope="col" key={term} className="num">{term}</th>)}</tr></thead>
        <tbody>{ws.subjects.map(subject => <tr key={subject.id}>
          <th scope="row"><SubjectDot color={subject.color}/> {subject.name}</th>
          {model.termPeriods.map((term, index) => {
            const id = key(subject.name, term);
            const value = id in drafts ? drafts[id] : stored(subject.name, term)?.toString() ?? '';
            const invalid = id in drafts && drafts[id].trim() !== '' && parseGradeInput(drafts[id]) === null;
            const estimate = model.rows.find(row => row.subject.id === subject.id)?.terms[index];
            return <td key={term} className="num">
              <input className={`grid-input ${invalid ? 'is-invalid' : ''}`} inputMode="decimal" value={value} aria-label={`${subject.name} ${term} report-card grade`} aria-invalid={invalid}
                placeholder={estimate && estimate.source === 'Estimated' ? `≈${estimate.grade.toFixed(0)}` : ''}
                title={estimate && estimate.source === 'Estimated' ? `Current estimate ${estimate.grade.toFixed(1)} — enter the official grade once released` : undefined}
                onChange={event => setDrafts(current => ({ ...current, [id]: event.target.value }))}
                onBlur={() => commit(subject.name, term)} onKeyDown={event => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); if (event.key === 'Escape') setDrafts(current => { const { [id]: _, ...rest } = current; return rest; }); }}/>
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <p className="card-footnote">Leave a cell empty to clear it. Grey hints show the current estimate from your scores. Current term: {shortPeriod(model.period)}.</p>
  </Panel>;
}
