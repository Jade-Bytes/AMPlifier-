import { useMemo, useState } from 'react';
import { ArrowRight, FlaskConical, Plus, ShieldCheck, Target, Trash2 } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Delta, Panel, SubjectDot, fmtGrade, useSvgId } from '../ui/primitives';
import { AnimatedNumber, useRevealCue, useThresholdCue } from '../ui/motion';
import { AreaFade, ChartTooltip } from '../charts/ChartParts';
import { useReducedMotion } from '../../lib/preferences';
import { chart, gradeDomain, gradeTicks } from '../charts/chartTheme';
import { calculateAverage, COMPONENT_LABELS, COMPONENTS, DEFAULT_GRADING_WEIGHTS } from '../../engine/calculator';
import { requiredScore, simulateSubject, type HypotheticalAssessment } from '../../engine/simulator';
import type { AcademicModel } from '../../state/useAcademicModel';
import type { Workspace } from '../../state/useWorkspace';
import type { GradeComponent } from '../../types/app';

type Props = { ws: Workspace; model: AcademicModel; subject: string; onSubjectChange: (subject: string) => void };

let nextId = 1;
const blank = (component: GradeComponent = 'ww', maxScore = '20'): HypotheticalRow => ({ id: `h${nextId++}`, component, score: '', maxScore });
type HypotheticalRow = { id: string; component: GradeComponent; score: string; maxScore: string };

export default function SimulatorView({ ws, model, subject: subjectName, onSubjectChange }: Props) {
  const base = ws.subjects.find(item => item.name === subjectName) ?? ws.subjects[0];
  const current = model.current.find(item => item.id === base?.id);
  const [rows, setRows] = useState<HypotheticalRow[]>(() => [blank()]);
  const reduced = useReducedMotion();
  useRevealCue(320);
  const fadeId = useSvgId('curve-fade');
  const [solveTarget, setSolveTarget] = useState(() => String(model.target ?? 90));
  const [solveComponent, setSolveComponent] = useState<GradeComponent>('exam');
  const [solveMax, setSolveMax] = useState('50');
  const weights = (base && ws.settings.gradingWeights[base.name]) ?? DEFAULT_GRADING_WEIGHTS;

  const hypotheticals: HypotheticalAssessment[] = rows
    .filter(row => row.score.trim() !== '' && row.maxScore.trim() !== '')
    .map(row => ({ id: row.id, component: row.component, score: Number(row.score), maxScore: Number(row.maxScore) }))
    .filter(item => Number.isFinite(item.score) && Number.isFinite(item.maxScore) && item.maxScore > 0 && item.score >= 0);

  const simulated = base ? simulateSubject(base, ws.assessments, hypotheticals, ws.settings.gradingWeights, model.period, model.options) : null;
  const delta = simulated && current?.hasGrades ? simulated.grade - current.grade : null;
  const simulatedGrade = simulated?.hasGrades ? simulated.grade : null;
  useThresholdCue(simulatedGrade, model.target, 650, base?.name);
  useThresholdCue(simulatedGrade, ws.settings.passingGrade, 650, base?.name);
  const averageWith = simulated?.hasGrades ? calculateAverage(model.current.map(item => item.id === simulated.id ? simulated : item).filter(item => item.hasGrades)) : null;

  const solve = useMemo(() => base ? requiredScore(base, ws.assessments, hypotheticals, solveComponent, Number(solveMax), Number(solveTarget), ws.settings.gradingWeights, model.period, model.options) : null,
    [base, ws.assessments, rows, solveComponent, solveMax, solveTarget, ws.settings.gradingWeights, model.period, model.options]);

  const curveRow = rows[0];
  const curveMax = Number(curveRow?.maxScore) > 0 ? Number(curveRow.maxScore) : 20;
  const curve = useMemo(() => {
    if (!base || !curveRow) return [];
    const others = hypotheticals.filter(item => item.id !== curveRow.id);
    return Array.from({ length: 21 }, (_, index) => {
      const score = Number((curveMax * index / 20).toFixed(2));
      return { score, grade: simulateSubject(base, ws.assessments, [...others, { id: 'curve', component: curveRow.component, score, maxScore: curveMax }], ws.settings.gradingWeights, model.period, model.options).grade };
    });
  }, [base, curveRow, curveMax, rows, ws.assessments, ws.settings.gradingWeights, model.period, model.options]);

  const update = (id: string, patch: Partial<HypotheticalRow>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));

  if (!base) return null;

  return <div className="view-stack">
    <div className="notice notice-info"><ShieldCheck size={16}/><span><b>Simulation only.</b> Nothing on this page is saved or changes your recorded grades.</span></div>
    <div className="grid-half">
      <Panel title="What if I score…" description={`Add one or more hypothetical scores for ${model.period}.`} actions={<FlaskConical size={16} className="text-muted"/>}>
        <label className="field">Subject
          <select value={base.name} onChange={event => onSubjectChange(event.target.value)}>{ws.subjects.map(item => <option key={item.id}>{item.name}</option>)}</select>
        </label>
        <div className="hypo-list">
          {rows.map((row, index) => <div className="hypo-row" key={row.id}>
            <span className="hypo-index">{index + 1}</span>
            <select aria-label={`Component for hypothetical score ${index + 1}`} value={row.component} onChange={event => update(row.id, { component: event.target.value as GradeComponent })}>{COMPONENTS.map(component => <option key={component} value={component}>{COMPONENT_LABELS[component]}</option>)}</select>
            <input aria-label={`Hypothetical score ${index + 1}`} type="number" min="0" step="any" inputMode="decimal" placeholder="Score" value={row.score} onChange={event => update(row.id, { score: event.target.value })}/>
            <span className="text-muted small">of</span>
            <input aria-label={`Maximum score ${index + 1}`} type="number" min="0" step="any" inputMode="decimal" value={row.maxScore} onChange={event => update(row.id, { maxScore: event.target.value })}/>
            <button className="btn-icon" aria-label={`Remove hypothetical score ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Trash2 size={14}/></button>
          </div>)}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setRows(current => [...current, blank(current.at(-1)?.component, current.at(-1)?.maxScore)])}><Plus size={14}/> Add another score</button>
      </Panel>

      <Panel title={<><SubjectDot color={base.color} size={10}/> Result</>} description={`${base.name} · ${model.period} · ${weights.ww}/${weights.pt}/${weights.exam} weights${ws.settings.gradingScale === 'deped' ? ' · DepEd transmuted' : ''}`}>
        <div className="compare">
          <div><span className="compare-label">Now</span><span className="compare-value"><AnimatedNumber value={current?.hasGrades ? current.grade : null}/></span></div>
          <div className="compare-arrow" aria-hidden="true"><ArrowRight size={22}/></div>
          <div><span className="compare-label">With these scores</span><span className="compare-value text-projected"><AnimatedNumber value={simulated?.hasGrades ? simulated.grade : null} duration={500} audible/></span></div>
          <div className="compare-delta"><Delta value={delta}/></div>
        </div>
        <ul className="component-list">
          {COMPONENTS.map(component => {
            const now = current?.[`${component}HasGrades`] ? current[component] : null;
            const next = simulated?.[`${component}HasGrades`] ? simulated[component] : null;
            return <li key={component}>
              <div className="component-row"><span>{COMPONENT_LABELS[component]} <span className="text-muted small">· {weights[component]}%</span></span><b>{fmtGrade(now)} → {fmtGrade(next)}</b></div>
              <div className="meter meter-compare" aria-hidden="true"><i className="meter-now" style={{ width: `${now ?? 0}%` }}/><i className="meter-next" style={{ width: `${next ?? 0}%` }}/></div>
            </li>;
          })}
        </ul>
        <p className="card-footnote">{model.period} general average: <b>{fmtGrade(model.currentAverage)}</b> → <b className="text-projected">{fmtGrade(averageWith)}</b></p>
      </Panel>
    </div>

    <div className="grid-half">
      <Panel title="What score do I need?" description="Minimum score on your next assessment to reach a grade in this subject." actions={<Target size={16} className="text-muted"/>}>
        <div className="form-grid form-grid-3">
          <label className="field">Target grade<input type="number" min="0" max="100" step="0.1" value={solveTarget} onChange={event => setSolveTarget(event.target.value)}/></label>
          <label className="field">Component<select value={solveComponent} onChange={event => setSolveComponent(event.target.value as GradeComponent)}>{COMPONENTS.map(component => <option key={component} value={component}>{COMPONENT_LABELS[component]}</option>)}</select></label>
          <label className="field">Out of<input type="number" min="1" step="any" value={solveMax} onChange={event => setSolveMax(event.target.value)}/></label>
        </div>
        <div className={`solve-result solve-${solve?.status ?? 'invalid'}`} aria-live="polite">
          {!solve || solve.status === 'invalid' ? <span>Enter a target from 0 to 100 and a maximum score above 0.</span>
            : solve.status === 'already-met' ? <span>You stay at or above <b>{solveTarget}</b> even with 0/{solveMax}{hypotheticals.length ? ' (including the scores above)' : ''}.</span>
            : solve.status === 'impossible' ? <span>Not reachable with one {COMPONENT_LABELS[solveComponent].toLowerCase()} out of {solveMax}: a perfect score gives <b>{fmtGrade(solve.bestGrade)}</b>.</span>
            : <><span>You need at least <b className="solve-score">{solve.score} / {solveMax}</b> ({solve.percent.toFixed(1)}%) to reach {solveTarget}.</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setRows(current => [...current.filter(row => row.score.trim() !== ''), { ...blank(solveComponent, solveMax), score: String(solve.score) }])}>Add to what-if</button></>}
        </div>
        <p className="card-footnote">Accounts for {hypotheticals.length ? 'your recorded scores plus the hypothetical scores above' : 'your recorded scores'} and uses the grade as displayed (one decimal).</p>
      </Panel>

      <Panel title="Grade by score" description={`${base.name} if hypothetical score 1 (${COMPONENT_LABELS[curveRow.component]}) ranged from 0 to ${curveMax}. Click a point to use it.`}>
        <div className="chart-box chart-glow" role="img" aria-label={`Estimated ${base.name} grade from ${curve[0]?.grade.toFixed(1)} at 0 to ${curve.at(-1)?.grade.toFixed(1)} at ${curveMax}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={curve} margin={{ top: 12, right: 16, left: -8, bottom: 0 }} onClick={(state: any) => { const point = state?.activePayload?.[0]?.payload; if (point) update(curveRow.id, { score: String(point.score) }); }}>
              <defs><AreaFade id={fadeId} color="var(--gain)" opacity={.28}/></defs>
              <CartesianGrid vertical={false} stroke={chart.grid}/>
              <XAxis type="number" dataKey="score" domain={[0, curveMax]} axisLine={false} tickLine={false} tick={chart.tick} tickCount={6}/>
              <YAxis domain={gradeDomain(curve.map(point => point.grade), ws.settings.passingGrade)} ticks={gradeTicks(gradeDomain(curve.map(point => point.grade), ws.settings.passingGrade))} axisLine={false} tickLine={false} tick={chart.tick} width={40}/>
              <ReferenceLine y={ws.settings.passingGrade} stroke={chart.passing} strokeOpacity={0.45} strokeDasharray="2 4"/>
              {Number(solveTarget) > 0 && <ReferenceLine y={Number(solveTarget)} stroke={chart.target} strokeDasharray="4 4"/>}
              {curveRow.score.trim() !== '' && <ReferenceLine x={Math.min(curveMax, Number(curveRow.score))} stroke={chart.projected}/>}
              <Tooltip cursor={{ stroke: chart.axis, strokeDasharray: '3 4' }} content={<ChartTooltip title={label => `Score ${label} / ${curveMax}`} names={{ grade: 'Estimated grade' }} footer={() => <small className="text-faint">Click to use this score</small>}/>}/>
              <Area type="monotone" dataKey="grade" stroke="none" fill={`url(#${fadeId})`} isAnimationActive={!reduced} {...chart.animation} tooltipType="none"/>
              <Line className="is-projected" type="monotone" dataKey="grade" stroke={chart.projected} strokeWidth={2.75} dot={false} activeDot={{ r: 6, cursor: 'pointer', fill: chart.projected, stroke: chart.dotFill, strokeWidth: 2 }} isAnimationActive={!reduced} {...chart.animation}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  </div>;
}
