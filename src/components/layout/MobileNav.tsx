import { useState } from 'react';
import { ChevronRight, CircleHelp, Ellipsis } from 'lucide-react';
import Dialog from '../ui/Dialog';
import { ALL_PAGES, pageInfo, type NavItem, type PageId } from './navigation';
import { initialsOf } from './Sidebar';
import type { AcademicProfile } from '../../types/app';

/** The four destinations students reach for most on a phone; everything else lives under More. */
const PRIMARY: PageId[] = ['overview', 'grades', 'tasks', 'schedule'];
const SHORT_LABEL: Partial<Record<PageId, string>> = { grades: 'Grades' };

type Props = {
  page: PageId;
  onNavigate: (page: PageId) => void;
  profile: AcademicProfile | null;
  displayName: string;
  photoURL: string | null;
  openTasks: number;
  overdueTasks: number;
  onOpenTour: () => void;
};

/** Phone navigation: a bottom tab bar within thumb reach, plus a More sheet for the remaining screens. */
export default function MobileNav({ page, onNavigate, profile, displayName, photoURL, openTasks, overdueTasks, onOpenTour }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const secondary = ALL_PAGES.filter(item => !PRIMARY.includes(item.id));
  const inMore = !PRIMARY.includes(page);

  const go = (id: PageId) => { setMoreOpen(false); onNavigate(id); };

  const tab = (entry: NavItem) => <button key={entry.id} className={`tab ${page === entry.id ? 'is-active' : ''}`} aria-current={page === entry.id ? 'page' : undefined} onClick={() => go(entry.id)}>
    <span className="tab-icon"><entry.icon size={21} aria-hidden="true"/>
      {entry.id === 'tasks' && openTasks > 0 && <span className={`tab-badge ${overdueTasks ? 'is-alert' : ''}`} aria-hidden="true">{openTasks}</span>}
    </span>
    <span className="tab-label">{SHORT_LABEL[entry.id] ?? entry.label}</span>
    {entry.id === 'tasks' && openTasks > 0 && <span className="sr-only">{`, ${openTasks} open${overdueTasks ? `, ${overdueTasks} overdue` : ''}`}</span>}
  </button>;

  return <>
    <nav className="tabbar" aria-label="Main navigation">
      {PRIMARY.map(id => tab(pageInfo(id)))}
      <button className={`tab ${inMore ? 'is-active' : ''}`} aria-haspopup="dialog" aria-expanded={moreOpen} aria-current={inMore ? 'page' : undefined} onClick={() => setMoreOpen(true)} data-sound="none">
        <span className="tab-icon"><Ellipsis size={21} aria-hidden="true"/></span>
        <span className="tab-label">{inMore ? pageInfo(page).label : 'More'}</span>
      </button>
    </nav>

    {moreOpen && <Dialog title="More" size="sm" onClose={() => setMoreOpen(false)}>
      <button className="more-account" onClick={() => go('settings')}>
        <span className="avatar">{photoURL ? <img src={photoURL} alt="" referrerPolicy="no-referrer"/> : initialsOf(displayName)}</span>
        <span><b>{displayName}</b><small>{[profile?.gradeLevel, profile?.section, profile?.academicYear].filter(Boolean).join(' · ') || 'Profile and settings'}</small></span>
        <ChevronRight size={16} aria-hidden="true"/>
      </button>
      <ul className="more-list">
        {secondary.map(item => <li key={item.id}>
          <button className={page === item.id ? 'is-active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
            <span className="more-icon"><item.icon size={18} aria-hidden="true"/></span>
            <span><b>{item.label}</b><small>{item.description}</small></span>
          </button>
        </li>)}
        <li><button onClick={() => { setMoreOpen(false); onOpenTour(); }}>
          <span className="more-icon"><CircleHelp size={18} aria-hidden="true"/></span>
          <span><b>App tour</b><small>A quick walk through every screen.</small></span>
        </button></li>
      </ul>
    </Dialog>}
  </>;
}
