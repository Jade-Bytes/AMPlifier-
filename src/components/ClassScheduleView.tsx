import { CalendarDays, Clock3, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { EmptyState, Panel, SubjectDot } from './ui/primitives';
import { WEEKDAYS } from './dialogs/ClassDialog';
import { relativeDay } from '../lib/dates';
import type { UpcomingItem } from '../state/useAcademicModel';
import type { ClassSession, Subject } from '../types/app';

type Props = { sessions: ClassSession[]; subjects: Subject[]; upcoming: UpcomingItem[]; onAdd: () => void; onEdit: (entry: ClassSession) => void; onDelete: (entry: ClassSession) => void };

function clock(value: string) {
  const [hourText, minute] = value.split(':');
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}

export default function ClassScheduleView({ sessions, subjects, upcoming, onAdd, onEdit, onDelete }: Props) {
  // Saturday is shown only when a class is scheduled on it.
  const days = WEEKDAYS.slice(0, sessions.some(entry => entry.dayOfWeek === 6) ? 6 : 5);
  const todayIndex = new Date().getDay(); // 0 = Sunday
  const week = upcoming.filter(item => !item.overdue).slice(0, 10);

  return <div className="view-stack">
    <Panel title="Weekly timetable" description="Recurring classes, Monday to Saturday.">
      {sessions.length === 0 ? <EmptyState icon={<CalendarDays size={20}/>} title="Your week is open" action={<button className="btn btn-secondary btn-sm" onClick={onAdd}><Plus size={14}/> Add your first class</button>}>Add your classes to see them laid out by day.</EmptyState> :
        <div className="week-grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(150px, 1fr))` }}>
          {days.map((day, index) => {
            const dayClasses = sessions.filter(entry => entry.dayOfWeek === index + 1).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return <section className={`week-day ${todayIndex === index + 1 ? 'is-today' : ''}`} key={day} aria-label={day}>
              <h3>{day.slice(0, 3)}<span>{todayIndex === index + 1 ? 'Today' : ''}</span></h3>
              {dayClasses.length === 0 ? <p className="text-faint small">No classes</p> : dayClasses.map(entry => {
                const color = subjects.find(item => item.name === entry.subject)?.color ?? 'var(--text-faint)';
                return <article className="class-card" key={entry.id} style={{ '--class-color': color } as React.CSSProperties}>
                  <span className="class-time"><Clock3 size={11}/> {clock(entry.startTime)} – {clock(entry.endTime)}</span>
                  <b>{entry.subject}</b>
                  {(entry.room || entry.teacher) && <small>{entry.room && <><MapPin size={11}/> {entry.room}</>}{entry.room && entry.teacher ? ' · ' : ''}{entry.teacher}</small>}
                  <span className="class-actions">
                    <button className="btn-icon" aria-label={`Edit ${entry.subject} on ${day}`} onClick={() => onEdit(entry)}><Pencil size={13}/></button>
                    <button className="btn-icon btn-icon-danger" aria-label={`Delete ${entry.subject} on ${day}`} onClick={() => onDelete(entry)}><Trash2 size={13}/></button>
                  </span>
                </article>;
              })}
            </section>;
          })}
        </div>}
    </Panel>
    <Panel title="Coming up" description="Open tasks and dated assessments.">
      {week.length === 0 ? <p className="text-muted small">Nothing scheduled.</p> : <ul className="upcoming-list">
        {week.map(item => <li key={item.id}>
          <SubjectDot color={subjects.find(subject => subject.name === item.subject)?.color ?? 'var(--text-faint)'}/>
          <span className="upcoming-text"><b>{item.title}</b><small>{[item.subject, item.kind].filter(Boolean).join(' · ')}</small></span>
          <span className="upcoming-date">{relativeDay(item.date)}</span>
        </li>)}
      </ul>}
    </Panel>
  </div>;
}
