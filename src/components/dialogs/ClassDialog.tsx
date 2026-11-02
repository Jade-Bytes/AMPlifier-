import { useState } from 'react';
import Dialog from '../ui/Dialog';
import { useFeedback } from '../ui/Feedback';
import type { Workspace } from '../../state/useWorkspace';
import type { ClassSession } from '../../types/app';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ClassDialog({ ws, entry, onClose }: { ws: Workspace; entry?: ClassSession; onClose: () => void }) {
  const { notify } = useFeedback();
  const [subject, setSubject] = useState(entry?.subject ?? ws.subjects[0]?.name ?? '');
  const [day, setDay] = useState(entry?.dayOfWeek ?? 1);
  const [start, setStart] = useState(entry?.startTime ?? '08:00');
  const [end, setEnd] = useState(entry?.endTime ?? '09:00');
  const [room, setRoom] = useState(entry?.room ?? '');
  const [teacher, setTeacher] = useState(entry?.teacher ?? '');
  const [error, setError] = useState('');

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!subject) { setError('Choose a subject for this class.'); return; }
    if (end <= start) { setError('The class must end after it starts.'); return; }
    const clash = ws.schedule.find(item => item.id !== entry?.id && item.dayOfWeek === day && start < item.endTime && end > item.startTime);
    if (clash) { setError(`This overlaps ${clash.subject} (${clash.startTime}–${clash.endTime}) on ${WEEKDAYS[day - 1]}.`); return; }
    ws.saveClass({ id: entry?.id ?? Date.now(), subject, dayOfWeek: day, startTime: start, endTime: end, room: room.trim(), teacher: teacher.trim() });
    notify(entry ? 'Class updated' : 'Class added to your timetable');
    onClose();
  }

  return <Dialog title={entry ? 'Edit class' : 'Add a class'} eyebrow="Weekly timetable" description="Classes repeat every week." onClose={onClose} footer={<>
    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
    <button type="submit" form="class-form" className="btn btn-primary">{entry ? 'Save class' : 'Add class'}</button>
  </>}>
    <form id="class-form" className="form-grid" onSubmit={save} noValidate>
      <label className="field">Subject<select data-autofocus value={subject} onChange={event => setSubject(event.target.value)}>{ws.subjects.map(item => <option key={item.id}>{item.name}</option>)}</select></label>
      <label className="field">Day<select value={day} onChange={event => setDay(Number(event.target.value))}>{WEEKDAYS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
      <label className="field">Starts<input type="time" value={start} onChange={event => setStart(event.target.value)}/></label>
      <label className="field">Ends<input type="time" value={end} onChange={event => setEnd(event.target.value)}/></label>
      <label className="field">Room <span className="field-optional">Optional</span><input value={room} maxLength={40} onChange={event => setRoom(event.target.value)} placeholder="e.g. Room 204"/></label>
      <label className="field">Teacher <span className="field-optional">Optional</span><input value={teacher} maxLength={60} onChange={event => setTeacher(event.target.value)} placeholder="Teacher name"/></label>
      {error && <p className="form-error field-span-2" role="alert">{error}</p>}
    </form>
  </Dialog>;
}
