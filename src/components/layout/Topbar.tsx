import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bell, CalendarDays, Check, CloudOff, Loader2, Moon, Search, Sun } from 'lucide-react';
import { usePreferences } from '../../lib/preferences';
import { PERIODS } from '../../engine/periods';
import { COMPONENT_LABELS } from '../../engine/calculator';
import { formatDate } from '../../lib/dates';
import { ALL_PAGES, type PageId } from './navigation';
import type { Assessment, Subject, Task } from '../../types/app';
import type { SaveState } from '../../state/useWorkspace';

export type SearchResult =
  | { kind: 'page'; id: string; label: string; detail: string; page: PageId }
  | { kind: 'subject'; id: string; label: string; detail: string; subject: Subject }
  | { kind: 'assessment'; id: string; label: string; detail: string; assessment: Assessment }
  | { kind: 'task'; id: string; label: string; detail: string; task: Task };

type Props = {
  subjects: Subject[];
  assessments: Assessment[];
  tasks: Task[];
  period: string;
  onPeriodChange: (period: string) => void;
  saveState: SaveState;
  demo: boolean;
  attentionCount: number;
  onOpenDeadlines: () => void;
  onSelect: (result: SearchResult) => void;
};

const KIND_LABEL: Record<SearchResult['kind'], string> = { page: 'Go to', subject: 'Subject', assessment: 'Assessment', task: 'Task' };

export default function Topbar({ subjects, assessments, tasks, period, onPeriodChange, saveState, demo, attentionCount, onOpenDeadlines, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const { resolvedTheme, update, play } = usePreferences();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.current?.focus(); input.current?.select(); setOpen(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    const has = (...values: (string | undefined)[]) => values.some(value => value?.toLowerCase().includes(term));
    return [
      ...ALL_PAGES.filter(page => has(page.label)).map(page => ({ kind: 'page' as const, id: `page-${page.id}`, label: page.label, detail: page.description, page: page.id })),
      ...subjects.filter(subject => has(subject.name, subject.code)).map(subject => ({ kind: 'subject' as const, id: `subject-${subject.id}`, label: subject.name, detail: 'Open in gradebook', subject })),
      ...assessments.filter(item => has(item.title, item.subject)).slice(0, 8).map(item => ({ kind: 'assessment' as const, id: `assessment-${item.id}`, label: item.title, detail: `${item.subject} · ${COMPONENT_LABELS[item.component]} · ${item.score}/${item.maxScore} · ${item.period}`, assessment: item })),
      ...tasks.filter(task => has(task.title, task.subject, task.kind, task.notes)).slice(0, 6).map(task => ({ kind: 'task' as const, id: `task-${task.id}`, label: task.title, detail: `${task.subject || 'No subject'} · ${task.kind}${task.dueDate ? ` · due ${formatDate(task.dueDate, { month: 'short', day: 'numeric' })}` : ''}${task.done ? ' · done' : ''}`, task })),
    ].slice(0, 14);
  }, [query, subjects, assessments, tasks]);

  function choose(result: SearchResult) {
    onSelect(result);
    setQuery('');
    setOpen(false);
    input.current?.blur();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(results.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && results[active]) { event.preventDefault(); choose(results[active]); }
    else if (event.key === 'Escape') { setQuery(''); setOpen(false); input.current?.blur(); }
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return <header className="topbar">
    <div className="search" role="combobox" aria-expanded={open && results.length > 0} aria-haspopup="listbox" aria-owns="search-results">
      <Search size={15} aria-hidden="true"/>
      <input ref={input} value={query} placeholder="Search subjects, assessments, tasks…" aria-label="Search" aria-autocomplete="list" aria-controls="search-results"
        aria-activedescendant={open && results[active] ? results[active].id : undefined}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onKeyDown={onKeyDown}/>
      <kbd aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      {open && query.trim() && <ul className="search-results glass-float" id="search-results" role="listbox">
        {results.length === 0 ? <li className="search-empty">No matches for “{query.trim()}”</li> : results.map((result, index) =>
          <li key={result.id} id={result.id} role="option" aria-selected={index === active} className={index === active ? 'is-active' : ''} onMouseDown={event => { event.preventDefault(); choose(result); }} onMouseEnter={() => setActive(index)}>
            <span className="search-kind">{KIND_LABEL[result.kind]}</span>
            <span className="search-text"><b>{result.label}</b><small>{result.detail}</small></span>
          </li>)}
      </ul>}
    </div>
    <div className="topbar-actions">
      <span className={`save-status save-${demo ? 'demo' : saveState}`} aria-live="polite">
        {demo ? <><CloudOff size={14}/> Preview, not saved</> : saveState === 'saving' ? <><Loader2 size={14} className="spin"/> Saving…</> : saveState === 'error' ? <><AlertCircle size={14}/> Not saved</> : saveState === 'saved' ? <><Check size={14}/> Saved</> : null}
      </span>
      <label className="period-picker" title="Grading period shown across the app">
        <CalendarDays size={15} aria-hidden="true"/>
        <span className="sr-only">Current grading period</span>
        <select value={period} onChange={event => onPeriodChange(event.target.value)}>{PERIODS.map(value => <option key={value}>{value}</option>)}</select>
      </label>
      <button className="btn-icon" onClick={() => { play('select'); update({ theme: resolvedTheme === 'dark' ? 'light' : 'dark' }); }} aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}>
        {resolvedTheme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}
      </button>
      <button className="btn-icon attention-btn" onClick={onOpenDeadlines} aria-label={attentionCount ? `${attentionCount} tasks overdue or due within 2 days` : 'No urgent deadlines'} title="Deadlines">
        <Bell size={17}/>{attentionCount > 0 && <span className="attention-count">{attentionCount}</span>}
      </button>
    </div>
  </header>;
}
