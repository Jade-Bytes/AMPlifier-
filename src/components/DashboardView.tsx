import React from 'react';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  PlusCircle,
  Sliders,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { EstimatedReportCard, GradingPeriod, Subject } from '../engine/types';
import { AcademicTask } from '../types/app';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  reportCard: EstimatedReportCard;
  subjects: Subject[];
  tasks: AcademicTask[];
  activeQuarter: GradingPeriod;
  onNavigate: (tab: NavTab) => void;
  onOpenAddScore: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  reportCard,
  subjects,
  tasks,
  activeQuarter,
  onNavigate,
  onOpenAddScore,
}) => {
  const currentGA = reportCard.currentGeneralAverage;
  const projectedGA = reportCard.projectedGeneralAverage;

  // Determine Philippine DepEd Honors Standing
  const getHonorsLabel = (ga: number | null) => {
    if (ga === null) return 'Awaiting Grades';
    if (ga >= 98) return 'With Highest Honors';
    if (ga >= 95) return 'With High Honors';
    if (ga >= 90) return 'With Honors';
    if (ga >= 75) return 'Good Academic Standing';
    return 'Academic Warning (Below 75)';
  };

  const pendingTasks = tasks.filter((t) => !t.isCompleted);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Academic Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time deterministic monitoring for <span className="font-semibold text-slate-200">{activeQuarter}</span> • Academic Year 2026-2027
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenAddScore}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Score</span>
          </button>
          <button
            onClick={() => onNavigate('simulator')}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700/80 transition"
          >
            <Sliders className="w-4 h-4 text-brand-400" />
            <span>Simulate Score</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current General Average */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-brand-500/10 group-hover:text-brand-500/20 transition-all">
            <Award className="w-24 h-24" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current General Average</p>
          <div className="flex items-baseline space-x-3 mt-3">
            <span className="text-4xl font-extrabold text-white tracking-tight">
              {currentGA !== null ? currentGA.toFixed(2) : '--'}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
              {activeQuarter} Standing
            </span>
          </div>
          <div className="mt-4 flex items-center space-x-2 text-xs font-medium text-amber-400">
            <Award className="w-4 h-4 text-amber-400" />
            <span>{getHonorsLabel(currentGA)}</span>
          </div>
        </div>

        {/* Projected Final GA */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-emerald-500/10 group-hover:text-emerald-500/20 transition-all">
            <TrendingUp className="w-24 h-24" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Projected Final GA</p>
          <div className="flex items-baseline space-x-3 mt-3">
            <span className="text-4xl font-extrabold text-emerald-400 tracking-tight">
              {projectedGA.toFixed(2)}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Full Year Target
            </span>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            Assumes steady performance across future quarters
          </div>
        </div>

        {/* Actionable Health */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 relative overflow-hidden">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Academic Attention Points</p>
          <div className="flex items-baseline space-x-2 mt-3">
            <span className="text-4xl font-extrabold text-white">
              {reportCard.weaknesses.length}
            </span>
            <span className="text-xs font-medium text-slate-400">detected items</span>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className={reportCard.weaknesses.length > 0 ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
              {reportCard.weaknesses.length > 0 ? 'Review recommendations below' : 'All subjects in strong standing'}
            </span>
            <button
              onClick={() => onNavigate('forecaster')}
              className="text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1"
            >
              <span>Forecast</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Weakness Detection Banner if any */}
      {reportCard.weaknesses.length > 0 && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 space-y-3">
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Academic Weakness & Risk Detection</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {reportCard.weaknesses.slice(0, 4).map((w) => (
              <div key={w.id} className="p-3 rounded-xl bg-amber-900/30 border border-amber-700/30 space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>{w.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                    w.severity === 'high' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {w.severity}
                  </span>
                </div>
                <p className="text-slate-300">{w.description}</p>
                <p className="text-amber-300/80 italic font-medium pt-1">💡 {w.suggestedAction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid: Subjects & Upcoming Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Subject Performance Standing (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Subject Performance Standing</h2>
              <p className="text-xs text-slate-400">Quarterly standing transmuted via DepEd Order No. 8, s. 2015</p>
            </div>
            <button
              onClick={() => onNavigate('scores')}
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center space-x-1"
            >
              <span>View Score Details</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reportCard.subjects.map((subAnnual) => {
              const subject = subjects.find((s) => s.id === subAnnual.subjectId);
              const qResult = subAnnual.quarters[activeQuarter];
              const quarterlyGrade = qResult?.quarterlyGrade ?? 0;
              const hasData = qResult && qResult.completionRatio > 0;

              return (
                <div
                  key={subAnnual.subjectId}
                  className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3 cursor-pointer"
                  onClick={() => onNavigate('scores')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: subject?.color || '#3b82f6' }}
                      />
                      <span className="font-bold text-sm text-slate-100">{subAnnual.subjectName}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-extrabold ${hasData ? 'text-white' : 'text-slate-500'}`}>
                        {hasData ? quarterlyGrade : '--'}
                      </span>
                      {hasData && (
                        <span className="block text-[10px] text-slate-400 font-medium">
                          Raw: {qResult.initialGrade.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        quarterlyGrade >= 90
                          ? 'bg-emerald-500'
                          : quarterlyGrade >= 80
                          ? 'bg-brand-500'
                          : quarterlyGrade >= 75
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, quarterlyGrade))}%` }}
                    />
                  </div>

                  {/* Sub components summary */}
                  {qResult && hasData ? (
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                      <div>
                        <span className="block font-semibold text-slate-300">WW:</span>
                        <span>{qResult.writtenWorks.hasAssessments ? `${qResult.writtenWorks.percentageScore.toFixed(0)}%` : '--'}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-300">PT:</span>
                        <span>{qResult.performanceTasks.hasAssessments ? `${qResult.performanceTasks.percentageScore.toFixed(0)}%` : '--'}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-300">Exam:</span>
                        <span>{qResult.quarterlyAssessment.hasAssessments ? `${qResult.quarterlyAssessment.percentageScore.toFixed(0)}%` : '--'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No scores recorded for {activeQuarter} yet</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Academic Responsibilities (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-brand-400" />
              <span>Upcoming Deadlines</span>
            </h2>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-brand-400 hover:text-brand-300"
            >
              All Tasks
            </button>
          </div>

          <div className="space-y-3">
            {pendingTasks.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
                <p>No pending assignments or assessments.</p>
                <button
                  onClick={() => onNavigate('tasks')}
                  className="text-brand-400 font-semibold hover:underline"
                >
                  Create an academic task
                </button>
              </div>
            ) : (
              pendingTasks.slice(0, 5).map((t) => {
                const sub = subjects.find((s) => s.id === t.subjectId);
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {sub?.name || 'General'}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-100">{t.title}</h4>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          t.priority === 'high'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">{t.description}</p>
                    )}
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                      <span>Due: {t.dueDate}</span>
                      <span className="text-slate-400 font-medium">{t.type}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
