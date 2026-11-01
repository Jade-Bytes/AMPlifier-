import React, { useState } from 'react';
import { Sliders, Target, ArrowRight, CheckCircle2, AlertOctagon } from 'lucide-react';
import { Assessment, GradingComponent, GradingPeriod, Subject } from '../engine/types';
import { simulateAssessments, calculateRequiredScore } from '../engine/simulator';

interface SimulatorViewProps {
  subjects: Subject[];
  actualAssessments: Assessment[];
  activeQuarter: GradingPeriod;
  futureAssumptions: Record<string, Partial<Record<GradingPeriod, number>>>;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  subjects,
  actualAssessments,
  activeQuarter,
  futureAssumptions,
}) => {
  const [activeMode, setActiveMode] = useState<'whatIf' | 'targetSolver'>('whatIf');

  // What-If Form State
  const [whatIfSubjectId, setWhatIfSubjectId] = useState(subjects[0]?.id || '');
  const [whatIfQuarter, setWhatIfQuarter] = useState<GradingPeriod>(activeQuarter);
  const [whatIfComponent, setWhatIfComponent] = useState<GradingComponent>('WW');
  const [whatIfScore, setWhatIfScore] = useState<string>('19');
  const [whatIfTotal, setWhatIfTotal] = useState<string>('20');

  // Target Solver State
  const [targetSubjectId, setTargetSubjectId] = useState(subjects[0]?.id || '');
  const [targetQuarter, setTargetQuarter] = useState<GradingPeriod>(activeQuarter);
  const [targetComponent, setTargetComponent] = useState<GradingComponent>('QA');
  const [desiredGrade, setDesiredGrade] = useState<number>(95);
  const [upcomingTotal, setUpcomingTotal] = useState<number>(50);

  // Compute What-If Simulation
  const hypoScoreNum = parseFloat(whatIfScore) || 0;
  const hypoTotalNum = parseFloat(whatIfTotal) || 1;

  const hypotheticalAssessments: Assessment[] = [
    {
      id: 'hypo_temp',
      subjectId: whatIfSubjectId,
      quarter: whatIfQuarter,
      component: whatIfComponent,
      title: 'Hypothetical Assessment',
      score: hypoScoreNum,
      totalPossible: hypoTotalNum,
    },
  ];

  const simResult = simulateAssessments(
    subjects,
    actualAssessments,
    hypotheticalAssessments,
    futureAssumptions
  );

  const targetSubject = subjects.find((s) => s.id === targetSubjectId) || subjects[0];
  const solverResult = targetSubject
    ? calculateRequiredScore(
        targetSubject,
        targetQuarter,
        targetComponent,
        desiredGrade,
        actualAssessments,
        upcomingTotal
      )
    : null;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Grade Simulator</h1>
          <p className="text-slate-400 text-sm mt-1">
            Experiment with hypothetical assessment scores without affecting your actual records.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
          <button
            onClick={() => setActiveMode('whatIf')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeMode === 'whatIf'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>What-If Sandbox</span>
          </button>
          <button
            onClick={() => setActiveMode('targetSolver')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeMode === 'targetSolver'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Target Score Solver</span>
          </button>
        </div>
      </div>

      {activeMode === 'whatIf' ? (
        /* What-If Sandbox Mode */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls Input (1 col) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="font-bold text-white text-base flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-brand-400" />
              <span>Simulate an Assessment</span>
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-300 mb-1">Subject</label>
                <select
                  value={whatIfSubjectId}
                  onChange={(e) => setWhatIfSubjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-brand-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Grading Period</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as GradingPeriod[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setWhatIfQuarter(q)}
                      className={`py-1.5 rounded-lg text-center font-bold transition ${
                        whatIfQuarter === q ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Assessment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'WW', label: 'Written' },
                    { id: 'PT', label: 'Perf. Task' },
                    { id: 'QA', label: 'Exam' },
                  ].map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setWhatIfComponent(comp.id as GradingComponent)}
                      className={`py-1.5 rounded-lg text-center font-bold transition ${
                        whatIfComponent === comp.id ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {comp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-300 mb-1">Hypothetical Score</label>
                  <input
                    type="number"
                    step="any"
                    value={whatIfScore}
                    onChange={(e) => setWhatIfScore(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Total Possible</label>
                  <input
                    type="number"
                    step="any"
                    value={whatIfTotal}
                    onChange={(e) => setWhatIfTotal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400 leading-relaxed">
              ⚡ Calculated purely in-memory. Zero changes made to your real grades.
            </div>
          </div>

          {/* Impact Results (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-bold text-white text-base">Projected Mathematical Impact</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subject Grade Card */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Subject Standing ({whatIfQuarter})
                </span>

                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Before</span>
                    <span className="text-3xl font-extrabold text-slate-400">
                      {simResult.subjectGradeBefore}
                    </span>
                  </div>

                  <ArrowRight className="w-5 h-5 text-slate-600" />

                  <div>
                    <span className="text-xs text-brand-400 block font-semibold">Simulated</span>
                    <span className="text-4xl font-extrabold text-white">
                      {simResult.subjectGradeAfter}
                    </span>
                  </div>

                  <span
                    className={`ml-auto text-sm font-extrabold px-3 py-1 rounded-full ${
                      simResult.subjectGradeDelta >= 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {simResult.subjectGradeDelta >= 0 ? `+${simResult.subjectGradeDelta}` : simResult.subjectGradeDelta}
                  </span>
                </div>
              </div>

              {/* General Average Card */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Projected Final General Average
                </span>

                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Before</span>
                    <span className="text-3xl font-extrabold text-slate-400">
                      {simResult.generalAverageBefore.toFixed(2)}
                    </span>
                  </div>

                  <ArrowRight className="w-5 h-5 text-slate-600" />

                  <div>
                    <span className="text-xs text-brand-400 block font-semibold">Simulated</span>
                    <span className="text-4xl font-extrabold text-white">
                      {simResult.generalAverageAfter.toFixed(2)}
                    </span>
                  </div>

                  <span
                    className={`ml-auto text-sm font-extrabold px-3 py-1 rounded-full ${
                      simResult.generalAverageDelta >= 0
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {simResult.generalAverageDelta >= 0
                      ? `+${simResult.generalAverageDelta.toFixed(2)}`
                      : simResult.generalAverageDelta.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Explanatory breakdown */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-2">
              <h4 className="font-bold text-slate-200">Simulation Summary</h4>
              <p>
                Scoring <strong>{hypoScoreNum}/{hypoTotalNum}</strong> ({Math.round((hypoScoreNum / hypoTotalNum) * 100)}%) on a {whatIfComponent} task moves your quarterly grade in{' '}
                <strong>{subjects.find((s) => s.id === whatIfSubjectId)?.name}</strong> from{' '}
                <strong>{simResult.subjectGradeBefore}</strong> to <strong>{simResult.subjectGradeAfter}</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Target Score Solver Mode */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="font-bold text-white text-base flex items-center space-x-2">
              <Target className="w-4 h-4 text-brand-400" />
              <span>Target Parameters</span>
            </h3>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-300 mb-1">Subject</label>
                <select
                  value={targetSubjectId}
                  onChange={(e) => setTargetSubjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-brand-500"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Grading Period</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as GradingPeriod[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setTargetQuarter(q)}
                      className={`py-1.5 rounded-lg text-center font-bold transition ${
                        targetQuarter === q ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Grading Component</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'WW', label: 'Written' },
                    { id: 'PT', label: 'Perf. Task' },
                    { id: 'QA', label: 'Exam' },
                  ].map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setTargetComponent(comp.id as GradingComponent)}
                      className={`py-1.5 rounded-lg text-center font-bold transition ${
                        targetComponent === comp.id ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {comp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Target Transmuted Grade (e.g. 90, 95)</label>
                <input
                  type="number"
                  min="60"
                  max="100"
                  value={desiredGrade}
                  onChange={(e) => setDesiredGrade(parseInt(e.target.value, 10) || 75)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Upcoming Assessment Total Points</label>
                <input
                  type="number"
                  min="1"
                  value={upcomingTotal}
                  onChange={(e) => setUpcomingTotal(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Solver Result Display (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="font-bold text-white text-base">Solver Output</h3>

            {solverResult && (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                <div className="flex items-center space-x-3">
                  {solverResult.isPossible ? (
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                      <AlertOctagon className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <h4 className="text-xl font-extrabold text-white">
                      {solverResult.isPossible ? 'Achievable Target' : 'Mathematically Unattainable'}
                    </h4>
                    <p className="text-xs text-slate-400">{solverResult.message}</p>
                  </div>
                </div>

                {solverResult.isPossible && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <span className="text-xs font-semibold text-slate-400 block">Required Raw Score</span>
                      <span className="text-3xl font-extrabold text-white mt-1 block">
                        {solverResult.requiredScore} / {solverResult.assessmentTotalPossible}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <span className="text-xs font-semibold text-slate-400 block">Required Percentage</span>
                      <span className="text-3xl font-extrabold text-brand-400 mt-1 block">
                        {solverResult.requiredPercentage}%
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <span className="text-xs font-semibold text-slate-400 block">Target Grade</span>
                      <span className="text-3xl font-extrabold text-emerald-400 mt-1 block">
                        {solverResult.targetQuarterlyGrade}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
