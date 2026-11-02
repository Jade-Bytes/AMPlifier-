import { useLayoutEffect, useRef, useState } from 'react';
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem, type PageId } from './navigation';
import { BrandMark, BrandWord } from '../ui/Brand';
import type { AcademicProfile } from '../../types/app';

type Props = {
  page: PageId;
  onNavigate: (page: PageId) => void;
  profile: AcademicProfile | null;
  displayName: string;
  handle: string;
  photoURL: string | null;
  openTasks: number;
  overdueTasks: number;
  onOpenTour: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

export default function Sidebar({ page, onNavigate, profile, displayName, handle, photoURL, openTasks, overdueTasks, onOpenTour, collapsed, onToggleCollapsed }: Props) {
  const rail = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ top: number } | null>(null);

  // The highlight slides between items: re-measure the active link when the page, rail width, or window changes.
  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    const measure = () => {
      const active = node.querySelector<HTMLElement>('.nav-link[aria-current=page]');
      setIndicator(active ? { top: active.offsetTop } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [page, collapsed]);

  const item = (entry: NavItem) => <button key={entry.id} className={`nav-link ${page === entry.id ? 'is-active' : ''}`} aria-current={page === entry.id ? 'page' : undefined} onClick={() => onNavigate(entry.id)} title={entry.label}>
    <entry.icon size={18} aria-hidden="true"/>
    <span className="nav-text">{entry.label}</span>
    {entry.id === 'tasks' && openTasks > 0 && <span className={`nav-badge ${overdueTasks ? 'is-alert' : ''}`} aria-label={`${openTasks} open tasks${overdueTasks ? `, ${overdueTasks} overdue` : ''}`}>{openTasks}</span>}
  </button>;

  return <aside className="sidebar" aria-label="Main navigation" ref={rail}>
    {indicator && <span className="nav-indicator" style={{ top: indicator.top }} aria-hidden="true"/>}
    <div className="sidebar-brand">
      <BrandMark/><BrandWord/>
      <button className="btn-icon sidebar-collapse" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}
      </button>
    </div>
    <button className="sidebar-account" onClick={() => onNavigate('settings')} title="Profile and settings">
      <span className="avatar">{photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer"/> : initialsOf(displayName)}</span>
      <span className="sidebar-account-text"><b>{displayName}</b><small>{[profile?.gradeLevel, profile?.section].filter(Boolean).join(' · ') || (handle ? `@${handle}` : '')}</small></span>
    </button>
    <nav className="sidebar-nav">
      {NAV_GROUPS.map(group => <div className="nav-group" key={group.label} role="group" aria-label={group.label}>
        <div className="nav-group-label" aria-hidden="true">{group.label}</div>
        {group.items.map(item)}
      </div>)}
    </nav>
    <div className="sidebar-footer">
      {profile?.academicYear && <div className="sidebar-year"><small>Academic year</small><b>{profile.academicYear}</b>{profile.schoolName && <span>{profile.schoolName}</span>}</div>}
      {item(SETTINGS_ITEM)}
      <button className="nav-link" onClick={onOpenTour} title="App tour"><CircleHelp size={18} aria-hidden="true"/><span className="nav-text">App tour</span></button>
    </div>
  </aside>;
}
