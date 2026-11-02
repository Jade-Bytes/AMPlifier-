import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, FlaskConical, Info, ListTodo, PenLine, Plus, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Delta, EmptyState, Panel, RingGauge, SubjectDot, fmtGrade, useSvgId } from '../ui/primitives';
import { AnimatedNumber, useThresholdCue } from '../ui/motion';
import { AreaFade, ChartTooltip } from '../charts/ChartParts';
import { chart, gradeDomain, gradeStatus, gradeTicks } from '../charts/chartTheme';
import { shortPeriod } from '../../engine/periods';
import { daysUntil, formatDate, relativeDay } from '../../lib/dates';
import { useReducedMotion } from '../../lib/preferences';
import type { AcademicModel } from '../../state/useAcademicModel';
import type { Workspace } from '../../state/useWorkspace';
import type { PageId } from '../layout/navigation';

type Props = {
  ws: Workspace;
  model: AcademicModel;
  navigate: (page: PageId) => void;
  openSubject: (name: string, page?: PageId) => void;
  openScore: () => void;
  openTask: () => void;
};

const severityIcon = { attention: AlertTriangle, info: Info, positive: CheckCircle2 };
const STATUS_LABEL = { good: 'on track', warn: 'below target', bad: 'below passing' };

export default function OverviewView({ ws, model, navigate, openSubject, openScore, openTask }: Props) {
  const reduced = useReducedMotion();
  const fadeId = useSvgId('trend-fade');
  const passing = ws.settings.passingGrade;
  const { trend, currentIndex, termPeriods, projection, required, target } = model;
  const previousAverage = currentIndex > 0 ? trend[currentIndex - 1]?.recorded ?? null : null;
  const currentTermAverage = trend[currentIndex]?.recorded ?? null;
  // Projected final crossing the target (after an edit elsewhere in the app) is a milestone.
  useThresholdCue(projection.show ? projection.average : null, target, 1100);

  if (!model.hasAnyGradeData) {
    const steps = [
      { done: ws.historicalGrades.length > 0, label: 'Enter report-card grades for finished terms', hint: 'So your year-to-date average is accurate.', action: () => navigate('grades') },
      { done: ws.assessments.length > 0, label: 'Record your first score', hint: 'Quizzes, tasks, and exams feed your estimated grade.', action: openScore },
      { done: model.target !== null, label: 'Set a final-average target', hint: 'See what you need in each remaining term.', action: () => navigate('forecast') },
      { done: ws.tasks.length > 0, label: 'Add an upcoming deadline', hint: 'Keep assignments and projects in view.', action: openTask },
    ];
    return <div className="view-stack">
      <Panel title="Get started" description={`${ws.subjects.length} subjects are set up for ${model.period}. Add your grades to unlock charts, projections, and insights.`}>
        <ol className="checklist">
          {steps.map(step => <li key={step.label} className={step.done ? 'is-done' : ''}>
            <span className="checklist-mark">{step.done ? <CheckCircle2 size={20}/> : <span/>}</span>
            <span className="checklist-text"><b>{step.label}</b><small>{step.hint}</small></span>
            {!step.done && <button className="btn btn-secondary btn-sm" onClick={step.action}>Start <ArrowRight size={14}/></button>}
          </li>)}
        </ol>
      </Panel>
    </div>;
  }

  const trendData = trend.map(point => ({ ...point, label: shortPeriod(point.period) }));
  const trendDomain = gradeDomain([...trend.flatMap(point => [point.recorded, point.projected]), target], passing);
  const hasProjection = trend.some(point => point.projected !== null);
  const graded = model.current.filter(subject => subject.hasGrades);
  const ungraded = model.current.filter(subject => !subject.hasGrades);
  const scaleLow = gradeDomain([...graded.map(subject => subject.grade), target], passing)[0];
  const level = (grade: number) => Math.max(3, Math.min(100, (grade - scaleLow) / (100 - scaleLow) * 100));
  const upcoming = model.upcoming.slice(0, 6);
  const termWord = termPeriods[0].startsWith('Semester') ? 'semester' : 'quarter';
  const requiredNote = target === null ? null
    : required.status === 'ok' ? required.required > 100 ? `Reaching ${target} would need ${required.required.toFixed(1)} on average in the remaining terms, above 100.`
      : required.required <= 0 ? `Your recorded grades already secure ${target}.`
      : `To finish at ${target}, average ${required.required.toFixed(1)} across the remaining ${required.remainingTerms} term grades.`
    : required.status === 'need-past-grades' ? 'Enter report-card grades for earlier terms to see what you need for your target.' : null;

  return <div className="view-stack">
    <section className="card hero" aria-labelledby="hero-label">
      <span className="hero-glow" aria-hidden="true"/>
      <div className="hero-figure">
        <span className="hero-label" id="hero-label"><span className="hero-live" aria-hidden="true"/>{model.period} general average</span>
        <span className="hero-number"><AnimatedNumber value={model.currentAverage} audible/></span>
        <span className="hero-meta">
          {previousAverage !== null && <><Delta value={currentTermAverage !== null ? currentTermAverage - previousAverage : null}/> vs {shortPeriod(termPeriods[currentIndex - 1])}</>}
          <span>{model.graded.length} of {model.current.length} subjects, estimated</span>
        </span>
        {requiredNote && <p className="hero-note"><Target size={15}/>{requiredNote}</p>}
      </div>

      <div className="hero-chart">
        <div className="chart-legend" aria-hidden="true">
          <span><i className="legend-line"/> Recorded</span>
          {hasProjection && <span><i className="legend-line legend-dashed"/> Projected</span>}
          {target !== null && <span><i className="legend-rule legend-target"/> Target {target}</span>}
          <span><i className="legend-rule legend-passing"/> Passing {passing}</span>
        </div>
        <div className="chart-box chart-glow" role="img" aria-label={`General average by ${termWord}: ${trend.map(point => `${point.period} ${point.recorded !== null ? point.recorded.toFixed(1) : point.projected !== null ? `${point.projected.toFixed(1)} projected` : 'no data'}`).join(', ')}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData} margin={{ top: 22, right: 6, left: 6, bottom: 0 }}>
              <defs><AreaFade id={fadeId} color="var(--signal)"/></defs>
              <CartesianGrid vertical={false} stroke={chart.grid}/>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chart.tick} dy={8} padding={{ left: 20, right: 28 }}/>
              <YAxis orientation="right" domain={trendDomain} ticks={gradeTicks(trendDomain)} axisLine={false} tickLine={false} tick={chart.tick} width={38}/>
              <Tooltip cursor={{ stroke: chart.axis, strokeDasharray: '3 4' }} content={<ChartTooltip title={(_, rows) => String(rows[0]?.payload?.period ?? '')} names={{ recorded: 'Recorded average', projected: 'Projected average' }}/>}/>
              {target !== null && <ReferenceLine y={target} stroke={chart.target} strokeDasharray="5 5" strokeOpacity={.9}/>}
              <ReferenceLine y={passing} stroke={chart.passing} strokeOpacity={.55} strokeDasharray="2 5"/>
              <Area type="monotone" dataKey="recorded" stroke="none" fill={`url(#${fadeId})`} connectNulls isAnimationActive={!reduced} {...chart.animation} tooltipType="none"/>
              <Line className="is-projected" type="monotone" dataKey="projected" stroke={chart.projected} strokeWidth={2} strokeDasharray="6 6" dot={{ r: 4, fill: chart.dotFill, stroke: chart.projected, strokeWidth: 2 }} connectNulls isAnimationActive={!reduced} {...chart.animation}/>
              <Line type="monotone" dataKey="recorded" stroke={chart.recorded} strokeWidth={3} dot={{ r: 4.5, fill: chart.dotFill, stroke: chart.recorded, strokeWidth: 2.5 }} activeDot={{ r: 6, fill: chart.recorded, stroke: chart.dotFill, strokeWidth: 2 }} connectNulls isAnimationActive={!reduced} {...chart.animation}>
                <LabelList dataKey="recorded" position="top" offset={12} formatter={(value: unknown) => typeof value === 'number' ? value.toFixed(1) : ''} style={{ fill: 'var(--text-2)', fontSize: 12, fontWeight: 700 }}/>
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="hero-strip">
        <button className="hero-metric" onClick={() => navigate('forecast')}>
          <RingGauge value={projection.show ? projection.average : null} target={target}/>
          <span><small>Projected final average</small><b className={projection.show ? 'text-projected' : ''}><AnimatedNumber value={projection.show ? projection.average : null}/></b>
            <em>{!projection.show ? 'Add term assumptions in Forecast' : projection.complete ? `${projection.projectedCount} projected term grade${projection.projectedCount === 1 ? '' : 's'} included` : `Partial: ${projection.filledTerms} of ${projection.totalTerms} term grades`}</em></span>
          <ChevronRight size={18} className="hero-metric-go" aria-hidden="true"/>
        </button>
        <div className="hero-metric">
          <span className="metric-icon"><TrendingUp size={19}/></span>
          <span><small>Year-to-date average</small><b><AnimatedNumber value={model.yearToDate}/></b><em>Actual and estimated grades through {shortPeriod(model.period)}</em></span>
        </div>
        <button className="hero-metric" onClick={() => navigate('tasks')}>
          <span className="metric-icon"><CalendarClock size={19}/></span>
          <span><small>Due this week</small><b><AnimatedNumber value={model.dueSoonCount} digits={0}/></b><em className={model.overdueCount ? 'text-danger' : ''}>{model.overdueCount ? `${model.overdueCount} overdue` : 'Nothing overdue'}</em></span>
          <ChevronRight size={18} className="hero-metric-go" aria-hidden="true"/>
        </button>
      </div>
    </section>

    <div className="grid-main-side grid-stretch">
      <Panel className="mixer-panel" title={`Subject levels, ${model.period}`} description="Estimated grade per subject. Select a subject to try what-if scores."
        actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('grades')}>Gradebook <ArrowRight size={14}/></button>}>
        {graded.length === 0 ? <EmptyState icon={<ClipboardList size={22}/>} title={`No scores for ${model.period} yet`} action={<button className="btn btn-secondary btn-sm" onClick={openScore}><Plus size={14}/> Record a score</button>}>Earlier terms still appear in the trend above.</EmptyState> : <>
          <div className="mixer">
            <div className="mixer-scale" aria-hidden="true">
              {target !== null && target > scaleLow && <span className="mixer-rule mixer-rule-target" style={{ bottom: `${level(target)}%` }}><span>Target {target}</span></span>}
              <span className="mixer-rule mixer-rule-passing" style={{ bottom: `${level(passing)}%` }}><span>Passing {passing}</span></span>
            </div>
            {model.current.map((subject, index) => {
              const status = subject.hasGrades ? gradeStatus(subject.grade, passing, target) : null;
              return <button key={subject.id} className="channel" onClick={() => openSubject(subject.name, 'simulator')} style={{ '--i': index } as CSSProperties}
                aria-label={subject.hasGrades ? `${subject.name}: ${subject.grade.toFixed(1)}, ${STATUS_LABEL[status!]}. Open in simulator.` : `${subject.name}: no scores yet. Open in simulator.`}>
                <span className={`channel-value ${subject.hasGrades ? '' : 'is-empty'}`} aria-hidden="true">{subject.hasGrades ? subject.grade.toFixed(1) : '—'}</span>
                <span className="channel-track" aria-hidden="true">{subject.hasGrades && <span className={`channel-fill ${status === 'warn' ? 'is-warn' : status === 'bad' ? 'is-bad' : ''}`} style={{ height: `${level(subject.grade)}%` }}/>}</span>
                <span className="channel-name" aria-hidden="true"><b><SubjectDot color={subject.color} size={7}/>{subject.code}</b><small><Delta value={model.changes[subject.name]}/></small></span>
              </button>;
            })}
          </div>
          <div className="mixer-legend">
            <span><i className="legend-swatch" style={{ background: 'var(--grad-signal)' }}/> {target !== null ? 'At or above target' : 'Passing'}</span>
            {target !== null && <span><i className="legend-swatch" style={{ background: 'var(--grad-valve)' }}/> Below target</span>}
            <span><i className="legend-swatch" style={{ background: 'var(--grad-coral)' }}/> Below {passing}</span>
            <span>Change vs previous {termWord} under each subject</span>
            {ungraded.length > 0 && <span>No scores yet: {ungraded.map(subject => subject.name).join(', ')}</span>}
          </div>
        </>}
      </Panel>

      <Panel title="Insights" description="Based only on grades you have recorded." actions={<Sparkles size={17}/>}>
        {model.insights.length === 0 ? <p className="text-muted small">Record scores in more subjects to see comparisons.</p> : <ul className="insight-list">
          {model.insights.slice(0, 5).map(insight => {
            const Icon = severityIcon[insight.severity];
            return <li key={insight.id} className={`insight insight-${insight.severity}`}>
              <Icon size={17} aria-hidden="true"/>
              <div><b>{insight.title}</b><p>{insight.detail}</p>
                {insight.subject && <button className="link-btn" onClick={() => openSubject(insight.subject!, insight.severity === 'attention' ? 'simulator' : 'grades')}>{insight.severity === 'attention' ? 'Explore what-if scores' : 'View subject'} <ArrowRight size={12}/></button>}
              </div>
            </li>;
          })}
        </ul>}
      </Panel>
    </div>

    <div className="grid-main-side">
      <Panel title="Coming up" description="Open tasks and dated assessments." actions={<button className="btn btn-ghost btn-sm" onClick={() => navigate('tasks')}>All tasks <ArrowRight size={14}/></button>}>
        {upcoming.length === 0 ? <EmptyState icon={<CalendarClock size={22}/>} title="Nothing scheduled" action={<button className="btn btn-secondary btn-sm" onClick={openTask}><Plus size={14}/> Add a task</button>}>Add deadlines so they show up here.</EmptyState> :
          <ul className="upcoming-list">
            {upcoming.map(item => {
              const color = ws.subjects.find(subject => subject.name === item.subject)?.color ?? 'var(--text-faint)';
              const soon = !item.overdue && daysUntil(item.date) <= 2;
              return <li key={item.id}>
                <span className={`date-tile ${item.overdue ? 'is-overdue' : soon ? 'is-soon' : ''}`} aria-hidden="true"><small>{formatDate(item.date, { month: 'short' })}</small><b>{formatDate(item.date, { day: 'numeric' })}</b></span>
                <span className="upcoming-text"><b>{item.title}</b><small><SubjectDot color={color} size={7}/>{[item.subject, item.kind].filter(Boolean).join(' · ')}</small></span>
                <span className={`upcoming-date ${item.overdue ? 'text-danger' : ''}`}>{item.overdue ? `Overdue, ${relativeDay(item.date).toLowerCase()}` : relativeDay(item.date)}</span>
              </li>;
            })}
          </ul>}
      </Panel>

      <Panel title="Quick actions">
        <div className="shortcut-list">
          <button className="shortcut" onClick={openScore}><span className="shortcut-icon"><PenLine size={17}/></span><span><b>Record a score</b><small>Add a quiz, task, or exam result</small></span><ChevronRight size={16}/></button>
          <button className="shortcut" onClick={openTask}><span className="shortcut-icon is-signal"><ListTodo size={17}/></span><span><b>Add a task</b><small>Track a deadline or project</small></span><ChevronRight size={16}/></button>
          <button className="shortcut" onClick={() => navigate('simulator')}><span className="shortcut-icon is-gain"><FlaskConical size={17}/></span><span><b>Try what-if scores</b><small>See how a score would move a grade</small></span><ChevronRight size={16}/></button>
        </div>
      </Panel>
    </div>
  </div>;
}
