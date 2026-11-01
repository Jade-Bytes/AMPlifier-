import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ScoreManagerView } from './components/ScoreManagerView';
import { ReportCardView } from './components/ReportCardView';
import { SimulatorView } from './components/SimulatorView';
import { ForecasterView } from './components/ForecasterView';
import { TasksView } from './components/TasksView';
import { SettingsView } from './components/SettingsView';
import { loadAppData, saveAppData } from './storage/localStore';
import { AppData, AcademicTask, SchoolConfig, UserProfile } from './types/app';
import { Assessment, GradingComponent, GradingPeriod } from './engine/types';
import { calculateEstimatedReportCard } from './engine/calculator';

export function App() {
  const [appData, setAppData] = useState<AppData>(() => loadAppData());
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // Global Quick Add Score Modal
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickSubjectId, setQuickSubjectId] = useState(appData.subjects[0]?.id || '');
  const [quickQuarter, setQuickQuarter] = useState<GradingPeriod>(appData.school.activeQuarter);
  const [quickComponent, setQuickComponent] = useState<GradingComponent>('WW');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickScore, setQuickScore] = useState('');
  const [quickTotal, setQuickTotal] = useState('');

  // Persist state changes
  useEffect(() => {
    saveAppData(appData);
  }, [appData]);

  // Continuously recalculate Estimated Report Card
  const reportCard = useMemo(() => {
    return calculateEstimatedReportCard(
      appData.subjects,
      appData.assessments,
      appData.futureAssumptions
    );
  }, [appData.subjects, appData.assessments, appData.futureAssumptions]);

  // Assessment Handlers
  const handleAddAssessment = (newAssessment: Omit<Assessment, 'id'>) => {
    const assessment: Assessment = {
      ...newAssessment,
      id: `a_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    setAppData((prev) => ({
      ...prev,
      assessments: [assessment, ...prev.assessments],
    }));
  };

  const handleDeleteAssessment = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      assessments: prev.assessments.filter((a) => a.id !== id),
    }));
  };

  // Future Assumptions Handler
  const handleUpdateFutureAssumption = (
    subjectId: string,
    quarter: GradingPeriod,
    assumedGrade: number
  ) => {
    setAppData((prev) => {
      const currentSub = prev.futureAssumptions[subjectId] || {};
      return {
        ...prev,
        futureAssumptions: {
          ...prev.futureAssumptions,
          [subjectId]: {
            ...currentSub,
            [quarter]: assumedGrade,
          },
        },
      };
    });
  };

  const handleResetAssumptions = () => {
    setAppData((prev) => ({
      ...prev,
      futureAssumptions: {},
    }));
  };

  // Task Handlers
  const handleAddTask = (newTask: Omit<AcademicTask, 'id'>) => {
    const task: AcademicTask = {
      ...newTask,
      id: `t_${Date.now()}`,
    };
    setAppData((prev) => ({
      ...prev,
      tasks: [task, ...prev.tasks],
    }));
  };

  const handleToggleTask = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
      ),
    }));
  };

  const handleDeleteTask = (id: string) => {
    setAppData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  };

  // Settings Handlers
  const handleUpdateSchoolConfig = (cfg: Partial<SchoolConfig>) => {
    setAppData((prev) => ({
      ...prev,
      school: { ...prev.school, ...cfg },
    }));
  };

  const handleUpdateUserProfile = (prof: Partial<UserProfile>) => {
    setAppData((prev) => ({
      ...prev,
      user: { ...prev.user, ...prof },
    }));
  };

  const handleRestoreData = (restored: AppData) => {
    setAppData(restored);
  };

  const handleSaveQuickScore = (e: React.FormEvent) => {
    e.preventDefault();
    const scoreNum = parseFloat(quickScore);
    const totalNum = parseFloat(quickTotal);
    if (isNaN(scoreNum) || isNaN(totalNum) || totalNum <= 0) return;

    handleAddAssessment({
      subjectId: quickSubjectId,
      quarter: quickQuarter,
      component: quickComponent,
      title: quickTitle.trim() || `${quickComponent} Assessment`,
      score: scoreNum,
      totalPossible: totalNum,
      date: new Date().toISOString().split('T')[0],
    });

    setQuickTitle('');
    setQuickScore('');
    setQuickTotal('');
    setIsQuickAddOpen(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        schoolName={appData.school.schoolName}
        studentName={appData.user.name}
        gradeAndSection={`${appData.school.gradeLevel} - ${appData.school.section}`}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {activeTab === 'dashboard' && (
          <DashboardView
            reportCard={reportCard}
            subjects={appData.subjects}
            tasks={appData.tasks}
            activeQuarter={appData.school.activeQuarter}
            onNavigate={setActiveTab}
            onOpenAddScore={() => setIsQuickAddOpen(true)}
          />
        )}

        {activeTab === 'scores' && (
          <ScoreManagerView
            subjects={appData.subjects}
            assessments={appData.assessments}
            activeQuarter={appData.school.activeQuarter}
            onAddAssessment={handleAddAssessment}
            onDeleteAssessment={handleDeleteAssessment}
          />
        )}

        {activeTab === 'reportCard' && (
          <ReportCardView
            reportCard={reportCard}
            subjects={appData.subjects}
            onUpdateFutureAssumption={handleUpdateFutureAssumption}
            onResetAssumptions={handleResetAssumptions}
          />
        )}

        {activeTab === 'simulator' && (
          <SimulatorView
            subjects={appData.subjects}
            actualAssessments={appData.assessments}
            activeQuarter={appData.school.activeQuarter}
            futureAssumptions={appData.futureAssumptions}
          />
        )}

        {activeTab === 'forecaster' && (
          <ForecasterView
            subjects={appData.subjects}
            assessments={appData.assessments}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            tasks={appData.tasks}
            subjects={appData.subjects}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            appData={appData}
            onUpdateSchoolConfig={handleUpdateSchoolConfig}
            onUpdateUserProfile={handleUpdateUserProfile}
            onRestoreData={handleRestoreData}
          />
        )}
      </main>

      {/* Global Quick Add Score Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Record Assessment Score</h3>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveQuickScore} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Subject</label>
                  <select
                    value={quickSubjectId}
                    onChange={(e) => setQuickSubjectId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    {appData.subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Grading Period</label>
                  <select
                    value={quickQuarter}
                    onChange={(e) => setQuickQuarter(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Q1">Quarter 1</option>
                    <option value="Q2">Quarter 2</option>
                    <option value="Q3">Quarter 3</option>
                    <option value="Q4">Quarter 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Grading Component</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'WW', label: 'Written Work' },
                    { id: 'PT', label: 'Performance Task' },
                    { id: 'QA', label: 'Quarterly Exam' },
                  ].map((comp) => (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setQuickComponent(comp.id as GradingComponent)}
                      className={`py-1.5 rounded-lg text-center font-bold transition ${
                        quickComponent === comp.id ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {comp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit Quiz 2"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Score</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="19"
                    value={quickScore}
                    onChange={(e) => setQuickScore(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Total</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="20"
                    value={quickTotal}
                    onChange={(e) => setQuickTotal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30"
                >
                  Save Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
