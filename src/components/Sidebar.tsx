import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Calculator,
  Sliders,
  TrendingUp,
  CheckSquare,
  Settings,
  Sparkles,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'scores'
  | 'reportCard'
  | 'simulator'
  | 'forecaster'
  | 'tasks'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  schoolName: string;
  studentName: string;
  gradeAndSection: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  schoolName,
  studentName,
  gradeAndSection,
}) => {
  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'dashboard', label: 'Command Center', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'scores', label: 'Score Tracker', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'reportCard', label: 'Estimated Report Card', icon: <Calculator className="w-5 h-5" /> },
    { id: 'simulator', label: 'Grade Simulator', icon: <Sliders className="w-5 h-5" />, badge: 'What-If' },
    { id: 'forecaster', label: 'Advanced Forecaster', icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'tasks', label: 'Academic Tasks', icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings & Storage', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Logo and Brand */}
        <div className="p-6 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 text-white font-extrabold text-xl tracking-wider">
              A
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xl tracking-tight text-white">AMPlifier</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Your academics, amplified.</p>
            </div>
          </div>

          {/* Student Profile Card */}
          <div className="mt-5 p-3 rounded-xl bg-slate-800/50 border border-slate-800">
            <p className="text-xs font-semibold text-slate-200 truncate">{studentName}</p>
            <p className="text-[11px] text-slate-400 truncate">{gradeAndSection}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{schoolName}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wider ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/20 text-xs">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>MCP Ready</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Deterministic engine decoupled from AI. Compatible with Claude & MCP hosts.
          </p>
        </div>
      </div>
    </aside>
  );
};
