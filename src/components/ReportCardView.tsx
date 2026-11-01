import React from 'react';
import { Award, Info, RefreshCw } from 'lucide-react';
import { EstimatedReportCard, GradingPeriod, Subject } from '../engine/types';

interface ReportCardViewProps {
  reportCard: EstimatedReportCard;
  subjects: Subject[];
  onUpdateFutureAssumption: (subjectId: string, quarter: GradingPeriod, assumedGrade: number) => void;
  onResetAssumptions: () => void;
}

const QUARTERS: GradingPeriod[] = ['Q1', 'Q2', 'Q3', 'Q4'];

export const ReportCardView: React.FC<ReportCardViewProps> = ({
  reportCard,
  subjects,
  onUpdateFutureAssumption,
  onResetAssumptions,
}) => {
  const getHonorsLabel = (ga: number) => {
    if (ga >= 98) return 'With Highest Honors';
    if (ga >= 95) return 'With High Honors';
    if (ga >= 90) return 'With Honors';
    if (ga >= 75) return 'Passed';
    return 'Failed';
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Estimated Report Card</h1>
          <p className="text-slate-400 text-sm mt-1">
            Continuously updated annual academic report card with future grade assumptions.
          </p>
        </div>

        <button
          onClick={onResetAssumptions}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Assumptions</span>
        </button>
      </div>

      {/* Info Callout */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start space-x-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-200">Interactive Future Projections:</strong> Cells marked with a dotted underline are future quarters. You can click and modify their assumed grades to test what final general average you will graduate with!
        </p>
      </div>

      {/* Report Card Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase font-extrabold tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Learning Area / Subject</th>
                <th className="px-4 py-4 text-center">Units</th>
                {QUARTERS.map((q) => (
                  <th key={q} className="px-4 py-4 text-center">
                    {q}
                  </th>
                ))}
                <th className="px-6 py-4 text-center">Projected Final</th>
                <th className="px-6 py-4 text-center">Remarks</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-medium">
              {reportCard.subjects.map((subAnnual) => {
                const subject = subjects.find((s) => s.id === subAnnual.subjectId);
                const isPassing = subAnnual.projectedFinalGrade >= 75;

                return (
                  <tr key={subAnnual.subjectId} className="hover:bg-slate-800/30 transition">
                    {/* Subject Name */}
                    <td className="px-6 py-4 flex items-center space-x-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: subject?.color || '#3b82f6' }}
                      />
                      <span className="font-bold text-slate-100">{subAnnual.subjectName}</span>
                    </td>

                    {/* Credit Units */}
                    <td className="px-4 py-4 text-center text-xs text-slate-400">
                      {subject?.units ?? 1.0}
                    </td>

                    {/* Q1 - Q4 Columns */}
                    {QUARTERS.map((q) => {
                      const qRes = subAnnual.quarters[q];
                      const isActual = qRes && qRes.completionRatio > 0;
                      const assumedValue = reportCard.futureAssumptions[subAnnual.subjectId]?.[q];
                      const displayGrade = isActual
                        ? qRes.quarterlyGrade
                        : (assumedValue ?? Math.round(subAnnual.projectedFinalGrade));

                      return (
                        <td key={q} className="px-4 py-4 text-center">
                          {isActual ? (
                            <span className="font-extrabold text-white text-base">
                              {qRes.quarterlyGrade}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="60"
                              max="100"
                              value={displayGrade || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  onUpdateFutureAssumption(subAnnual.subjectId, q, val);
                                }
                              }}
                              className="w-14 text-center bg-slate-800/80 hover:bg-slate-800 border-b-2 border-brand-500/50 focus:border-brand-400 rounded px-1 py-0.5 text-brand-300 font-bold focus:outline-none text-sm transition"
                              title="Click to edit assumed future grade"
                            />
                          )}
                        </td>
                      );
                    })}

                    {/* Projected Final Grade */}
                    <td className="px-6 py-4 text-center">
                      <span className={`text-base font-extrabold ${isPassing ? 'text-white' : 'text-red-400'}`}>
                        {subAnnual.projectedFinalGrade.toFixed(1)}
                      </span>
                    </td>

                    {/* Remarks */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          isPassing
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {isPassing ? 'Passed' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Quarterly Averages Summary Row */}
              <tr className="bg-slate-950/60 font-bold border-t-2 border-slate-800 text-slate-300">
                <td className="px-6 py-4">Quarterly General Average</td>
                <td className="px-4 py-4 text-center">--</td>
                {QUARTERS.map((q) => (
                  <td key={q} className="px-4 py-4 text-center text-brand-400 text-base">
                    {reportCard.quarterlyAverages[q] !== null
                      ? reportCard.quarterlyAverages[q]?.toFixed(1)
                      : '--'}
                  </td>
                ))}
                <td className="px-6 py-4 text-center text-xl font-extrabold text-emerald-400">
                  {reportCard.projectedGeneralAverage.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-xs font-bold text-amber-400 flex items-center justify-center space-x-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>{getHonorsLabel(reportCard.projectedGeneralAverage)}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
