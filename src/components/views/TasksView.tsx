import { useState } from 'react';
import { Check, Flag, ListTodo, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState, Panel, Segmented, SubjectDot } from '../ui/primitives';
import { useSound } from '../../lib/preferences';
import { daysUntil, formatDate, relativeDay, todayISO, toISODate } from '../../lib/dates';
import type { Workspace } from '../../state/useWorkspace';
import type { Task } from '../../types/app';

type Props = { ws: Workspace; openTask: (task?: Task) => void; deleteTask: (task: Task) => void };
type Status = 'open' | 'done' | 'all';

const due = (task: Task) => task.dueDate ?? toISODate(task.date);
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

export default function TasksView({ ws, openTask, deleteTask }: Props) {
  const [status, setStatus] = useState<Status>('open');
  const [subject, setSubject] = useState('all');
  const [search, setSearch] = useState('');
  const today = todayISO();
  const play = useSound();

  const visible = ws.tasks
    .filter(task => status === 'all' || (status === 'done' ? task.done : !task.done))
    .filter(task => subject === 'all' || task.subject === subject)
    .filter(task => !search.trim() || `${task.title} ${task.notes ?? ''} ${task.kind}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(a.done) - Number(b.done) || due(a).localeCompare(due(b)) || PRIORITY_RANK[a.priority ?? 'normal'] - PRIORITY_RANK[b.priority ?? 'normal']);

  const groups: { label: string; tone?: string; items: Task[] }[] = [
    { label: 'Overdue', tone: 'danger', items: visible.filter(task => !task.done && daysUntil(due(task), today) < 0) },
    { label: 'Today', items: visible.filter(task => !task.done && daysUntil(due(task), today) === 0) },
    { label: 'Next 7 days', items: visible.filter(task => !task.done && daysUntil(due(task), today) > 0 && daysUntil(due(task), today) <= 7) },
    { label: 'Later', items: visible.filter(task => !task.done && daysUntil(due(task), today) > 7) },
    { label: 'Completed', items: visible.filter(task => task.done).reverse() },
  ].filter(group => group.items.length);

  const openCount = ws.tasks.filter(task => !task.done).length;

  return <Panel title="Planner" description={`${openCount} open task${openCount === 1 ? '' : 's'}. Sorted by due date, then priority.`}>
    <div className="toolbar">
      <Segmented label="Show tasks" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'All' }]}/>
      <select aria-label="Filter tasks by subject" value={subject} onChange={event => setSubject(event.target.value)}><option value="all">All subjects</option>{ws.subjects.map(item => <option key={item.id}>{item.name}</option>)}</select>
      <label className="input-icon"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks" aria-label="Search tasks"/></label>
    </div>
    {groups.length === 0 ? <EmptyState icon={<ListTodo size={20}/>} title={ws.tasks.length ? 'No tasks match' : 'No tasks yet'} action={!ws.tasks.length && <button className="btn btn-secondary btn-sm" onClick={() => openTask()}><Plus size={14}/> Add your first task</button>}>
      {ws.tasks.length ? 'Try a different filter.' : 'Add homework, projects, and exams with their due dates.'}
    </EmptyState> : groups.map(group => <section className="task-group" key={group.label}>
      <h3 className={`task-group-title ${group.tone ? `text-${group.tone}` : ''}`}>{group.label} <span>{group.items.length}</span></h3>
      <ul className="task-list">{group.items.map(task => {
        const date = due(task);
        const overdue = !task.done && daysUntil(date, today) < 0;
        const color = ws.subjects.find(item => item.name === task.subject)?.color;
        return <li key={task.id} className={`task ${task.done ? 'is-done' : ''}`}>
          <button className={`task-check ${task.done ? 'is-checked' : ''}`} role="checkbox" aria-checked={task.done} aria-label={`Mark ${task.title} ${task.done ? 'not done' : 'done'}`} onClick={() => { play(task.done ? 'toggleOff' : openCount === 1 ? 'milestone' : 'complete'); ws.toggleTask(task.id); }}>{task.done && <Check size={13}/>}</button>
          <div className="task-body">
            <b>{task.title}{task.priority === 'high' && !task.done && <span className="priority-flag" title="High priority"><Flag size={12}/> High</span>}</b>
            <small>{color && <SubjectDot color={color} size={7}/>} {[task.subject, task.kind].filter(Boolean).join(' · ')}{task.notes ? ` · ${task.notes}` : ''}</small>
          </div>
          <span className={`task-due ${overdue ? 'text-danger' : ''}`} title={formatDate(date)}>{relativeDay(date, today)}</span>
          <span className="task-actions">
            <button className="btn-icon" aria-label={`Edit ${task.title}`} title="Edit" onClick={() => openTask(task)}><Pencil size={14}/></button>
            <button className="btn-icon btn-icon-danger" aria-label={`Delete ${task.title}`} title="Delete" onClick={() => deleteTask(task)}><Trash2 size={14}/></button>
          </span>
        </li>;
      })}</ul>
    </section>)}
  </Panel>;
}
