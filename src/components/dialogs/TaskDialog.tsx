import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { useFeedback } from '../ui/Feedback';
import { Segmented } from '../ui/primitives';
import { formatDate, todayISO } from '../../lib/dates';
import type { Workspace } from '../../state/useWorkspace';
import type { Task, TaskPriority } from '../../types/app';

export const TASK_KINDS = ['Homework', 'Assignment', 'Quiz', 'Exam', 'Project', 'Performance Task', 'Reading', 'Other'];
const priorityOptions: { value: TaskPriority; label: string }[] = [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }];

export default function TaskDialog({ ws, task, subject: presetSubject, onClose }: { ws: Workspace; task?: Task; subject?: string; onClose: () => void }) {
  const { notify } = useFeedback();
  const [title, setTitle] = useState(task?.title ?? '');
  const [subject, setSubject] = useState(task?.subject ?? presetSubject ?? '');
  const [kind, setKind] = useState(task?.kind ?? 'Homework');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? todayISO());
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [error, setError] = useState('');

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setError('Give the task a name.'); return; }
    if (!dueDate) { setError('Choose a due date.'); return; }
    const next: Task = {
      id: task?.id ?? Date.now(), title: title.trim(), subject, kind, dueDate, done: task?.done ?? false, priority,
      date: formatDate(dueDate, { month: 'short', day: '2-digit' }), ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    ws.saveTask(next);
    notify(task ? 'Task updated' : 'Task added to your planner');
    onClose();
  }

  return <Dialog title={task ? 'Edit task' : 'Add a task'} eyebrow="Planner" onClose={onClose} footer={<>
    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
    <button type="submit" form="task-form" className="btn btn-primary">{task ? 'Save task' : 'Add to planner'}</button>
  </>}>
    <form id="task-form" className="form-grid" onSubmit={save} noValidate>
      <label className="field field-span-2">Task
        <input data-autofocus value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="e.g. Prepare for science quiz" aria-invalid={Boolean(error) && !title.trim()}/>
      </label>
      <label className="field">Subject
        <select value={subject} onChange={event => setSubject(event.target.value)}><option value="">No subject</option>{ws.subjects.map(item => <option key={item.id}>{item.name}</option>)}</select>
      </label>
      <label className="field">Type
        <select value={kind} onChange={event => setKind(event.target.value)}>{TASK_KINDS.map(item => <option key={item}>{item}</option>)}</select>
      </label>
      <label className="field">Due date
        <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/>
      </label>
      <div className="field"><span className="field-label">Priority</span><Segmented label="Priority" value={priority} options={priorityOptions} onChange={setPriority}/></div>
      <label className="field field-span-2">Notes <span className="field-optional">Optional</span>
        <textarea rows={3} maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Pages, instructions, materials…"/>
      </label>
      {error && <p className="form-error field-span-2" role="alert">{error}</p>}
    </form>
  </Dialog>;
}
