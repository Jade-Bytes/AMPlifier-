import { Eraser, Target } from 'lucide-react';
import { Panel, SubjectDot, TermGradeCell, fmtGrade } from '../ui/primitives';
import { AnimatedNumber, useRevealCue, useThresholdCue } from '../ui/motion';
import { useFeedback } from '../ui/Feedback';
import { applyAssumptions, mean, parseGradeInput, projectedGeneralAverage, SCENARIOS, scenarioAssumptions, type ScenarioKey } from '../../engine/reportCard';
import { shortPeriod } from '../../engine/periods';
import type { AcademicModel } from '../../state/useAcademicModel';
import type { Workspace } from '../../state/useWorkspace';
import type { FutureGrades } from '../../types/app';
import type { PageId } from '../layout/navigation';

type Props = { ws: Workspace; model: AcademicModel; navigate: (page: PageId) => void };

export default function ForecastView({ ws, model, navigate }: Props) {
  const { confirm, notify } = useFeedback();
  useRevealCue(420);
  const { termPeriods, currentIndex, rows, projection, required, target } = model;
  useThresholdCue(projection.show ? projection.average : null, target, 1000);
  const future = ws.settings.futureGrades;
  const targetInvalid = ws.settings.targetAverage.trim() !== '' && target === null;
  const hasAssumptions = Object.values(future).some(terms => Object.values(terms).some(value => value.trim() !== ''));

  function setAssumption(subject: string, term: string, value: string) {
    ws.updateSettings({ futureGrades: { ...future, [subject]: { ...(future[subject] ?? {}), [term]: value } } });
  }

  const scenarios = SCENARIOS.map(scenario => {
    const assumptions = scenarioAssumptions(rows, termPeriods, currentIndex, scenario.key);
    return { ...scenario, assumptions, summary: projectedGeneralAverage(applyAssumptions(rows, termPeriods, assumptions)) };
  });
  const comparison = [...scenarios.map(item => ({ key: item.key as ScenarioKey | 'mine', label: item.label, description: item.description, average: item.summary.average, complete: item.summary.complete, assumptions: item.assumptions as FutureGrades | null })),
    { key: 'mine' as const, label: 'Your assumptions', description: 'The projected grades you typed in the table above', average: projection.show ? projection.average : null, complete: projection.complete, assumptions: null }];

  async function applyScenario(label: string, assumptions: FutureGrades) {
    if (hasAssumptions && !await confirm({ title: `Replace your assumptions with the ${label.toLowerCase()} scenario?`, message: 'Projected grades you typed for upcoming terms will be overwritten. Recorded grades are never changed.', confirmLabel: 'Replace assumptions' })) return;
    ws.updateSettings({ futureGrades: assumptions }, { immediate: true });
    notify(`${label} scenario applied to your projections`);
  }

  async function clearAssumptions() {
    if (!await confirm({ title: 'Clear all projected grades?', message: 'Only your assumptions are removed. Recorded grades stay as they are.', confirmLabel: 'Clear projections', destructive: true })) return;
    ws.updateSettings({ futureGrades: {} }, { immediate: true });
    notify('Projections cleared');
  }

  const remainingTerms = termPeriods.slice(currentIndex);
  const scale = (value: number | null) => value === null ? 0 : Math.max(2, Math.min(100, (value - 60) / 40 * 100));

  return <div className="view-stack">
    <div className="stat-grid">
      <label className="stat stat-input">
        <span className="stat-label">Final average target</span>
        <span className="stat-input-row"><input type="number" min="0" max="100" step="0.1" value={ws.settings.targetAverage} placeholder="e.g. 90" aria-invalid={targetInvalid} onChange={event => ws.updateSettings({ targetAverage: event.target.value })}/></span>
        <span className={`stat-meta ${targetInvalid ? 'text-danger' : ''}`}>{targetInvalid ? 'Enter a number from 0 to 100' : 'Saved automatically'}</span>
      </label>
      <div className="stat"><span className="stat-label">Year-to-date average</span><span className="stat-value"><AnimatedNumber value={model.yearToDate}/></span><span className="stat-meta">Recorded grades through {shortPeriod(model.period)}</span></div>
      <div className="stat"><span className="stat-label">Projected final average</span><span className="stat-value stat-projected"><AnimatedNumber value={projection.show ? projection.average : null} audible/></span><span className="stat-meta">{!projection.show ? 'Add assumptions below' : projection.complete ? 'Every term has a grade' : `Partial · ${projection.filledTerms}/${projection.totalTerms} term grades`}</span></div>
      <div className="stat"><span className="stat-label">Needed in remaining terms</span>
        <span className={`stat-value ${required.status === 'ok' && required.required > 100 ? 'text-danger' : ''}`}>{required.status === 'ok' ? (required.required <= 0 ? 'Met' : fmtGrade(required.required)) : '—'}</span>
        <span className="stat-meta">{required.status === 'ok' ? `Average across ${required.remainingTerms} unrecorded term grades` : required.status === 'need-past-grades' ? <button className="link-btn" onClick={() => navigate('grades')}>Enter {required.missingPastTerms} earlier report-card grade{required.missingPastTerms === 1 ? '' : 's'}</button> : required.status === 'no-target' ? 'Set a target first' : 'No terms remaining'}</span>
      </div>
    </div>

    <Panel title="Term-by-term projection" description="Recorded grades fill in automatically. Type assumptions for the current and upcoming terms; they are saved as you type."
      actions={hasAssumptions && <button className="btn btn-ghost btn-sm" onClick={() => void clearAssumptions()}><Eraser size={14}/> Clear projections</button>}>
      <div className="table-scroll">
        <table className="data-table forecast-table">
          <thead><tr><th scope="col">Subject</th>{termPeriods.map((term, index) => <th scope="col" key={term} className={`num ${index === currentIndex ? 'is-current' : ''}`}>{term}{index === currentIndex && <small>current</small>}</th>)}<th scope="col" className="num">Final</th></tr></thead>
          <tbody>{rows.map(row => {
            const filled = row.terms.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
            const final = mean(filled.map(entry => entry.grade));
            return <tr key={row.subject.id}>
              <th scope="row"><SubjectDot color={row.subject.color}/> {row.subject.name}</th>
              {row.terms.map((entry, index) => {
                const term = termPeriods[index];
                if (entry && entry.source !== 'Projected') return <td key={term} className="num"><TermGradeCell entry={entry} passingGrade={ws.settings.passingGrade}/></td>;
                if (index < currentIndex) return <td key={term} className="num"><button className="link-btn text-faint" onClick={() => navigate('grades')} title="Enter the official grade in the Gradebook">Missing</button></td>;
                const raw = future[row.subject.name]?.[term] ?? '';
                const invalid = raw.trim() !== '' && parseGradeInput(raw) === null;
                return <td key={term} className="num"><input className={`grid-input grid-input-projected ${invalid ? 'is-invalid' : ''}`} inputMode="decimal" value={raw} placeholder="—" aria-invalid={invalid} aria-label={`${row.subject.name} projected ${term} grade`} onChange={event => setAssumption(row.subject.name, term, event.target.value)}/></td>;
              })}
              <td className="num"><strong>{fmtGrade(final)}</strong>{final !== null && filled.length < termPeriods.length && <small className="text-faint"> partial</small>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="card-footnote">Each term counts equally toward a subject’s final grade, and each subject counts equally toward the general average. Missing terms are left out, never counted as zero.</p>
    </Panel>

    <div className="grid-half">
      <Panel title="Scenario comparison" description="Projected final general average if every unrecorded term followed each pattern.">
        <ul className="scenario-list">
          {comparison.map(item => <li key={item.key} className={item.key === 'mine' ? 'is-mine' : ''}>
            <div className="scenario-head"><b>{item.label}</b><span className="scenario-value">{fmtGrade(item.average)}{item.average !== null && !item.complete && <small> partial</small>}</span></div>
            <div className="scenario-bar" aria-hidden="true"><i style={{ width: `${scale(item.average)}%` }}/>{target !== null && <span className="scenario-target" style={{ left: `${scale(target)}%` }}/>}</div>
            <div className="scenario-foot"><small>{item.description}</small>{item.assumptions && Object.keys(item.assumptions).length > 0 && <button className="link-btn" onClick={() => void applyScenario(item.label, item.assumptions!)}>Use these</button>}</div>
          </li>)}
        </ul>
        <p className="card-footnote">Scale shows 60–100{target !== null ? `; the tick marks your target of ${target}` : ''}. Scenarios are derived from your own recorded term grades.</p>
      </Panel>

      <Panel title="Grade to aim for, by subject" description={target === null ? 'Set a final average target to see per-subject goals.' : `Average needed in each unrecorded term for the subject to finish at ${target}.`} actions={<Target size={16} className="text-muted"/>}>
        {target === null ? <p className="text-muted small">Type a target in the first box above.</p> :
          <div className="table-scroll"><table className="data-table goals-table">
            <thead><tr><th scope="col">Subject</th>{remainingTerms.map(term => <th scope="col" key={term} className="num">{shortPeriod(term)}</th>)}</tr></thead>
            <tbody>{model.goals.map(goal => <tr key={goal.subject.id}>
              <th scope="row"><SubjectDot color={goal.subject.color}/> {goal.subject.name}</th>
              {remainingTerms.map((term, offset) => {
                const entry = goal.terms[currentIndex + offset];
                if (!goal.priorComplete) return <td key={term} className="num text-faint" title="Enter earlier report-card grades first">needs past grades</td>;
                if (entry?.source === 'Actual') return <td key={term} className="num"><TermGradeCell entry={entry}/></td>;
                const needed = goal.needed;
                return <td key={term} className={`num ${needed !== null && needed > 100 ? 'text-danger' : needed !== null && needed <= 0 ? 'text-accent' : ''}`}>
                  <strong>{needed === null ? '—' : needed > 100 ? '>100' : needed <= 0 ? 'Met' : needed.toFixed(1)}</strong>
                  {entry?.source === 'Estimated' && <small className="text-faint"> now {entry.grade.toFixed(1)}</small>}
                </td>;
              })}
            </tr>)}</tbody>
          </table></div>}
      </Panel>
    </div>
  </div>;
}
