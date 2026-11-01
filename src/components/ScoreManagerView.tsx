import React, { useState } from 'react';
import {
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Assessment,
  GradingComponent,
  GradingPeriod,
  Subject,
} from '../engine/types';
import { calculateQuarterlySubject } from '../engine/calculator';

interface ScoreManagerViewProps {
  subjects: Subject[];
  assessments: Assessment[];
  activeQuarter: GradingPeriod;
  onAddAssessment: (assessment: Omit<Assessment, 'id'>) => void;
  onDeleteAssessment: (id: string) => void;
}

export const ScoreManagerView: React.FC<ScoreManagerViewProps> = ({
  subjects,
  assessments,
  activeQuarter: defaultQuarter,
  onAddAssessment,
  onDeleteAssessment,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || ''
  );
  const [selectedQuarter, setSelectedQuarter] = useState<GradingPeriod>(defaultQuarter);

  // Modal State for adding score
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalComponent, setModalComponent] = useState<GradingComponent>('WW');
  const [modalTitle, setModalTitle] = useState('');
  const [modalScore, setModalScore] = useState('');
  const [modalTotal, setModalTotal] = useState('');
  const [modalMultiplier, setModalMultiplier] = useState('1');

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  const quarterlyResult = selectedSubject
    ? calculateQuarterlySubject(selectedSubject, selectedQuarter, assessments)
    : null;

  const currentAssessments = assessments.filter(
    (a) => a.subjectId === selectedSubject?.id && a.quarter === selectedQuarter
  );

  const wwAssessments = currentAssessments.filter((a) => a.component === 'WW');
  const ptAssessments = currentAssessments.filter((a) => a.component === 'PT');
  const qaAssessments = currentAssessments.filter((a) => a.component === 'QA');

  const handleOpenAddModal = (comp: GradingComponent) => {
    setModalComponent(comp);
    setModalTitle('');
    setModalScore('');
    setModalTotal('');
    setModalMultiplier('1');
    setIsAddModalOpen(true);
  };

  const handleSaveAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;

    const scoreNum = parseFloat(modalScore);
    const totalNum = parseFloat(modalTotal);
    const multNum = parseFloat(modalMultiplier) || 1.0;

    if (isNaN(scoreNum) || isNaN(totalNum) || totalNum <= 0) {
      alert('Please enter valid numeric score and total possible points.');
      return;
    }

    onAddAssessment({
      subjectId: selectedSubject.id,
      quarter: selectedQuarter,
      component: modalComponent,
      title: modalTitle.trim() || `${modalComponent} Assessment`,
      score: scoreNum,
      totalPossible: totalNum,
      weightMultiplier: multNum,
      date: new Date().toISOString().split('T')[0],
    });

    setIsAddModalOpen(false);
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header and Selectors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Daily Score Tracker</h1>
          <p className="text-slate-400 text-sm mt-1">
            Record assessments and observe immediate deterministic recalculation of your quarterly standing.
          </p>
        </div>

        {/* Controls: Quarter and Subject Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quarter Tabs */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as GradingPeriod[]).map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedQuarter === q
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Subject Dropdown */}
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white font-semibold text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-brand-500"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subject Summary Card */}
      {selectedSubject && quarterlyResult && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <span
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedSubject.color || '#3b82f6' }}
              />
              <h2 className="text-2xl font-extrabold text-white">{selectedSubject.name}</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold">
                {selectedQuarter}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Grading Weights: Written Works ({(selectedSubject.weights.ww * 100).toFixed(0)}%), Performance Tasks ({(selectedSubject.weights.pt * 100).toFixed(0)}%), Examination ({(selectedSubject.weights.qa * 100).toFixed(0)}%)
            </p>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Initial Weighted Score</span>
              <span className="text-2xl font-extrabold text-slate-200">
                {quarterlyResult.completionRatio > 0 ? `${quarterlyResult.initialGrade.toFixed(2)}%` : '--'}
              </span>
            </div>

            <div className="w-px h-12 bg-slate-800" />

            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-400 block">Quarterly Grade</span>
              <span className="text-4xl font-extrabold text-white">
                {quarterlyResult.completionRatio > 0 ? quarterlyResult.quarterlyGrade : '--'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3 Components Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Written Works */}
        <ComponentColumn
          componentTitle="Written Works (WW)"
          weightPercent={(selectedSubject?.weights.ww || 0.4) * 100}
          component="WW"
          result={quarterlyResult?.writtenWorks}
          assessments={wwAssessments}
          onOpenAdd={() => handleOpenAddModal('WW')}
          onDelete={onDeleteAssessment}
        />

        {/* Performance Tasks */}
        <ComponentColumn
          componentTitle="Performance Tasks (PT)"
          weightPercent={(selectedSubject?.weights.pt || 0.4) * 100}
          component="PT"
          result={quarterlyResult?.performanceTasks}
          assessments={ptAssessments}
          onOpenAdd={() => handleOpenAddModal('PT')}
          onDelete={onDeleteAssessment}
        />

        {/* Quarterly Assessment / Exam */}
        <ComponentColumn
          componentTitle="Quarterly Exam (QA)"
          weightPercent={(selectedSubject?.weights.qa || 0.2) * 100}
          component="QA"
          result={quarterlyResult?.quarterlyAssessment}
          assessments={qaAssessments}
          onOpenAdd={() => handleOpenAddModal('QA')}
          onDelete={onDeleteAssessment}
        />
      </div>

      {/* Add Assessment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">
                Add {modalComponent === 'WW' ? 'Written Work' : modalComponent === 'PT' ? 'Performance Task' : 'Quarterly Exam'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssessment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assessment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quiz 3, Lab Report, Prelim Exam"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Score Earned</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 19"
                    value={modalScore}
                    onChange={(e) => setModalScore(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Total Possible</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 20"
                    value={modalTotal}
                    onChange={(e) => setModalTotal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Weight Multiplier (Optional)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={modalMultiplier}
                  onChange={(e) => setModalMultiplier(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  placeholder="Default 1.0 (major tests can be 2.0)"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface ComponentColumnProps {
  componentTitle: string;
  weightPercent: number;
  component: GradingComponent;
  result?: any;
  assessments: Assessment[];
  onOpenAdd: () => void;
  onDelete: (id: string) => void;
}

const ComponentColumn: React.FC<ComponentColumnProps> = ({
  componentTitle,
  weightPercent,
  result,
  assessments,
  onOpenAdd,
  onDelete,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-sm">{componentTitle}</h3>
            <span className="text-xs text-brand-400 font-semibold">{weightPercent.toFixed(0)}% Weight</span>
          </div>
          <button
            onClick={onOpenAdd}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            title="Add score"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Standing Header */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Standing</span>
            <span className="text-white font-bold text-sm">
              {result?.hasAssessments ? `${result.percentageScore.toFixed(1)}%` : 'No scores'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block font-medium">Weighted Pts</span>
            <span className="text-emerald-400 font-bold text-sm">
              {result?.hasAssessments ? `+${result.weightedScore.toFixed(2)}` : '--'}
            </span>
          </div>
        </div>

        {/* List of Assessments */}
        <div className="space-y-2 min-h-[160px] max-h-[360px] overflow-y-auto pr-1">
          {assessments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No assessments recorded yet.
            </div>
          ) : (
            assessments.map((a) => {
              const pct = (a.score / a.totalPossible) * 100;
              return (
                <div
                  key={a.id}
                  className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-200">{a.title}</p>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-2">
                      <span className="font-bold text-slate-300">
                        {a.score} / {a.totalPossible}
                      </span>
                      <span>•</span>
                      <span className={pct >= 90 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-red-400'}>
                        {pct.toFixed(0)}%
                      </span>
                      {a.weightMultiplier && a.weightMultiplier !== 1 && (
                        <span className="text-[10px] bg-slate-800 px-1 rounded text-brand-300">
                          {a.weightMultiplier}x
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => onDelete(a.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <button
        onClick={onOpenAdd}
        className="w-full py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition flex items-center justify-center space-x-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Entry</span>
      </button>
    </div>
  );
};
