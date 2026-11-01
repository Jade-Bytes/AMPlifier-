import React, { useState } from 'react';
import { TrendingUp, Target, CheckCircle2, AlertCircle } from 'lucide-react';
import { Assessment, Subject } from '../engine/types';
import { generateStandardScenarios, calculateMinimumFutureGradesForTargetGA } from '../engine/forecaster';

interface ForecasterViewProps {
  subjects: Subject[];
  assessments: Assessment[];
}

export const ForecasterView: React.FC<ForecasterViewProps> = ({ subjects, assessments }) => {
  const [targetGA, setTargetGA] = useState<number>(95);

  const scenarios = generateStandardScenarios(subjects, assessments);
  const targetPlan = calculateMinimumFutureGradesForTargetGA(subjects, assessments, targetGA);

  const getScenarioBadge = (type: string) => {
    switch (type) {
      case 'conservative':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'realistic':
        return 'bg-brand-500/20 text-brand-300 border-brand-500/30';
      case 'optimistic':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Advanced Grade Forecasting</h1>
        <p className="text-slate-400 text-sm mt-1">
          Predict future general averages across multi-path scenarios and solve required grades for honors goals.
        </p>
      </div>

      {/* Target General Average Solver Section */}
      <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-white flex items-center space-x-2">
              <Target className="w-5 h-5 text-indigo-400" />
              <span>Target General Average Planner</span>
            </h3>
            <p className="text-xs text-slate-400">
              Set your dream final general average (e.g. 90 with honors, 95 with high honors) to compute the required pace.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-300">Target GA:</span>
            <input
              type="number"
              min="75"
              max="100"
              step="0.5"
              value={targetGA}
              onChange={(e) => setTargetGA(parseFloat(e.target.value) || 75)}
              className="w-24 bg-slate-800 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-base font-extrabold text-white focus:outline-none focus:border-indigo-400 text-center"
            />
          </div>
        </div>

        {/* Solver Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-xs font-semibold text-slate-400 block">Required Average on Remaining Quarters</span>
            <span className="text-3xl font-extrabold text-indigo-400 block">
              {targetPlan.requiredAverageOnRemaining.toFixed(1)}
            </span>
            <span className="text-[11px] text-slate-400 block">
              Across all remaining subjects and grading periods
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-xs font-semibold text-slate-400 block">Remaining Quarters Remaining</span>
            <span className="text-3xl font-extrabold text-white block">
              {targetPlan.remainingQuartersCount} Quarters
            </span>
            <span className="text-[11px] text-slate-400 block">
              Historical average: {targetPlan.currentCompletedAverage !== null ? targetPlan.currentCompletedAverage.toFixed(1) : 'None'}
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-xs font-semibold text-slate-400 block">Feasibility Status</span>
            <div className="flex items-center space-x-2 mt-1">
              {targetPlan.isAchievable ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              )}
              <span className={`text-base font-bold ${targetPlan.isAchievable ? 'text-emerald-400' : 'text-red-400'}`}>
                {targetPlan.isAchievable ? 'Mathematically Feasible' : 'Exceeds Maximum Possible (100)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 leading-snug">{targetPlan.summary}</p>
          </div>
        </div>
      </div>

      {/* 3 Standard Scenarios Comparison Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-brand-400" />
          <span>Forecasting Scenarios Comparison</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {scenarios.map((scen) => (
            <div
              key={scen.id}
              className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getScenarioBadge(scen.type)}`}>
                    {scen.type}
                  </span>
                  <h4 className="text-lg font-extrabold text-white mt-2">{scen.name}</h4>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-white block">
                    {scen.projectedGeneralAverage.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold block">Projected GA</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                {scen.description}
              </p>

              {/* Subject Projections List */}
              <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
                <span className="font-bold text-slate-300 block mb-1">Subject Projections:</span>
                {subjects.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-0.5 text-slate-400">
                    <span className="truncate max-w-[140px]">{s.name}</span>
                    <span className="font-bold text-slate-200">
                      {scen.subjectProjections[s.id]?.toFixed(1) ?? '--'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
