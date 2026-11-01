import React, { useState } from 'react';
import {
  Save,
  Download,
  Upload,
  RotateCcw,
  Cloud,
  CheckCircle2,
  School,
  User,
} from 'lucide-react';
import { AppData, SchoolConfig, UserProfile } from '../types/app';
import { exportBackupJSON, importBackupJSON, createInitialData } from '../storage/localStore';

interface SettingsViewProps {
  appData: AppData;
  onUpdateSchoolConfig: (config: Partial<SchoolConfig>) => void;
  onUpdateUserProfile: (profile: Partial<UserProfile>) => void;
  onRestoreData: (restored: AppData) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  appData,
  onUpdateSchoolConfig,
  onUpdateUserProfile,
  onRestoreData,
}) => {
  // Form states
  const [userName, setUserName] = useState(appData.user.name);
  const [userEmail, setUserEmail] = useState(appData.user.email || '');

  const [schoolName, setSchoolName] = useState(appData.school.schoolName);
  const [gradeLevel, setGradeLevel] = useState(appData.school.gradeLevel);
  const [section, setSection] = useState(appData.school.section);
  const [academicYear, setAcademicYear] = useState(appData.school.academicYear);
  const [activeQuarter, setActiveQuarter] = useState(appData.school.activeQuarter);

  const [saveNotice, setSaveNotice] = useState(false);

  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUserProfile({ name: userName, email: userEmail });
    onUpdateSchoolConfig({
      schoolName,
      gradeLevel,
      section,
      academicYear,
      activeQuarter,
    });
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2500);
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportBackupJSON(appData);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amplifier_backup_${new Date().toISOString().split('T')[0]}.ampbackup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const restored = importBackupJSON(text);
        onRestoreData(restored);
        alert('Academic records restored successfully!');
      } catch (err: any) {
        alert('Failed to restore backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefault = () => {
    if (confirm('Are you sure you want to reset records to default sample data? All unsaved scores will be replaced.')) {
      const initial = createInitialData();
      onRestoreData(initial);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Settings & Storage</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your account profile, school grading configuration, and Google Drive backup files.
        </p>
      </div>

      {saveNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center space-x-2 text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5" />
          <span>Academic settings saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSaveConfigs} className="space-y-6">
        {/* School & Academic Configuration */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
            <School className="w-5 h-5 text-brand-400" />
            <span>School & Academic Profile</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
            <div>
              <label className="block text-slate-300 mb-1">School Name</label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Academic Year</label>
              <input
                type="text"
                required
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Grade Level</label>
              <input
                type="text"
                required
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Section</label>
              <input
                type="text"
                required
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Active Quarter</label>
              <select
                value={activeQuarter}
                onChange={(e) => setActiveQuarter(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="Q1">Quarter 1 (Q1)</option>
                <option value="Q2">Quarter 2 (Q2)</option>
                <option value="Q3">Quarter 3 (Q3)</option>
                <option value="Q4">Quarter 4 (Q4)</option>
              </select>
            </div>
          </div>
        </div>

        {/* User Account */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
            <User className="w-5 h-5 text-indigo-400" />
            <span>User Profile</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
            <div>
              <label className="block text-slate-300 mb-1">Student Full Name</label>
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Email (Google Account Sync)</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-600/30 transition"
            >
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </form>

      {/* Google Drive & Backup Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Cloud className="w-5 h-5 text-emerald-400" />
          <span>Storage & Backup Infrastructure</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Backup */}
          <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h4 className="font-bold text-sm text-slate-200">Export Academic Backup</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export your entire academic portfolio (all subjects, scores, tasks, and future assumptions) to a secure `.ampbackup.json` file.
            </p>
            <button
              onClick={handleDownloadBackup}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-brand-300 font-bold text-xs border border-slate-700 transition"
            >
              <Download className="w-4 h-4" />
              <span>Download Backup File</span>
            </button>
          </div>

          {/* Import Backup */}
          <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
            <h4 className="font-bold text-sm text-slate-200">Restore from Backup</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Restore previously saved records from an AMPlifier `.ampbackup.json` file or Google Drive export.
            </p>
            <label className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Select File to Restore</span>
              <input
                type="file"
                accept=".json,.ampbackup.json"
                onChange={handleFileRestore}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Reset Danger Zone */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Resetting returns the app to sample demonstration data.
          </div>
          <button
            onClick={handleResetToDefault}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40 text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Sample Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
