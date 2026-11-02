import { useState } from 'react';
import { ArrowRight, BookOpen, Check, Plus, Trash2 } from 'lucide-react';
import { BrandMark, BrandWord } from './ui/Brand';
import { DEFAULT_GRADING_WEIGHTS, weightsAreValid } from '../engine/calculator';
import { PERIODS } from '../engine/periods';
import type { AcademicSetup, GradingWeights, SetupSubject } from '../types/app';

const commonSubjects = ['English', 'Filipino', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'TLE', 'Values Education'];
const schoolOptions = ["Saint Paul's School of Ormoc", 'Philippine Science High School', 'Ateneo de Manila University', 'De La Salle University', 'University of Santo Tomas', 'University of the Philippines'];
const gradeOptions = ['Kindergarten', ...Array.from({ length: 12 }, (_, index) => `Grade ${index + 1}`), ...Array.from({ length: 6 }, (_, index) => `${index + 1}${['st','nd','rd'][index] ?? 'th'} year college`), 'Other'];
const academicYearOptions = ['2025-2026', '2026-2027', '2027-2028', '2028-2029', 'Other'];

type Props = {
  userName: string;
  saving: boolean;
  error: string;
  onComplete: (setup: AcademicSetup) => void;
};

export default function AcademicSetupPage({ userName, saving, error, onComplete }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [schoolChoice, setSchoolChoice] = useState('');
  const [customSchool, setCustomSchool] = useState('');
  const [gradeChoice, setGradeChoice] = useState('');
  const [customGrade, setCustomGrade] = useState('');
  const [section, setSection] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [customAcademicYear, setCustomAcademicYear] = useState('');
  const [period, setPeriod] = useState('Quarter 1');
  const [startingFresh, setStartingFresh] = useState('');
  const [subjects, setSubjects] = useState<SetupSubject[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [formError, setFormError] = useState('');

  function addSubject(name: string) {
    const cleanName = name.trim();
    if (!cleanName || subjects.some(subject => subject.name.toLowerCase() === cleanName.toLowerCase())) return;
    setSubjects(current => [...current, { name: cleanName, weights: { ...DEFAULT_GRADING_WEIGHTS } }]);
    setSubjectName('');
  }

  function updateWeights(index: number, key: keyof GradingWeights, value: number) {
    setSubjects(current => current.map((subject, subjectIndex) => subjectIndex === index
      ? { ...subject, weights: { ...subject.weights, [key]: value } }
      : subject));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const schoolName = schoolChoice === '__other__' ? customSchool.trim() : schoolChoice;
    const gradeLevel = gradeChoice === 'Other' ? customGrade.trim() : gradeChoice;
    const year = academicYear === 'Other' ? customAcademicYear.trim() : academicYear;
    if (displayName.trim().length < 2) { setFormError('Enter a display name with at least 2 characters.'); return; }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) { setFormError('Your @username must be 3–20 characters using letters, numbers, or underscores.'); return; }
    if (!schoolName || !gradeLevel || !year) { setFormError('Choose your school, grade level, and academic year to continue.'); return; }
    if (!startingFresh) { setFormError('Let us know whether you are just starting or already in a grading period.'); return; }
    if (subjects.length === 0) { setFormError('Add at least one of your subjects to continue.'); return; }
    const invalid = subjects.find(subject => !weightsAreValid(subject.weights));
    if (invalid) { setFormError(`${invalid.name} grading criteria need to total 100%.`); return; }
    onComplete({
      profile: { displayName: displayName.trim(), username: cleanUsername, schoolName, gradeLevel, section: section.trim(), academicYear: year, startingFresh: startingFresh === 'yes' },
      subjects,
      period,
    });
  }

  return <main className="setup-page">
    <header className="setup-brand"><BrandMark/><BrandWord/><i>Account setup</i></header>
    <section className="setup-card glass">
      <div className="setup-intro"><div className="setup-icon"><BookOpen size={19}/></div><div className="setup-eyebrow">Let’s make this yours</div><h1>Set up your academic workspace</h1><p>Welcome{userName?`, ${userName}`:''}. Choose how you’ll appear, then add your school, subjects, and grading criteria.</p></div>
      <div className="setup-clean-note"><Check size={16}/><span><b>Clean gradebook.</b> No sample grades or assessments are preloaded. Your grades appear only after you enter your own scores.</span></div>
      <form onSubmit={submit}>
        <div className="setup-section-title"><span>01</span><div><b>Your profile</b><small>Choose the name classmates will see and your unique username.</small></div></div>
        <div className="setup-fields">
          <label className="setup-field">Display name<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="e.g. Alex Santos" maxLength={40} autoComplete="nickname" required/></label>
          <label className="setup-field">@username<input value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0,20))} placeholder="e.g. alex_santos" maxLength={20} autoComplete="username" required/><small className="setup-hint">3–20 letters, numbers, or underscores. Must be unique.</small></label>
        </div>
        <div className="setup-section-title"><span>02</span><div><b>School details</b><small>Your academic year starts at 2026-2027. You can change it here.</small></div></div>
        <div className="setup-fields">
          <label className="setup-field setup-field-wide">School<select value={schoolChoice} onChange={event => setSchoolChoice(event.target.value)} required><option value="">Choose your school</option>{schoolOptions.map(school => <option key={school} value={school}>{school}</option>)}<option value="__other__">My school isn’t listed</option></select></label>
          {schoolChoice === '__other__'&&<label className="setup-field setup-field-wide">School name<input value={customSchool} onChange={event => setCustomSchool(event.target.value)} placeholder="Type your school name" autoComplete="organization" required/></label>}
          <label className="setup-field">Grade level<select value={gradeChoice} onChange={event => setGradeChoice(event.target.value)} required><option value="">Choose grade level</option>{gradeOptions.map(grade => <option key={grade}>{grade}</option>)}</select></label>
          {gradeChoice === 'Other'&&<label className="setup-field">Grade or year level<input value={customGrade} onChange={event => setCustomGrade(event.target.value)} placeholder="Enter your grade or year" required/></label>}
          <label className="setup-field">Section <span className="setup-optional">Optional</span><input value={section} onChange={event => setSection(event.target.value)} placeholder="e.g. Einstein"/></label>
          <label className="setup-field">Academic year<select value={academicYear} onChange={event => setAcademicYear(event.target.value)}>{academicYearOptions.map(year => <option key={year}>{year}</option>)}</select></label>
          {academicYear === 'Other'&&<label className="setup-field">Academic year<input value={customAcademicYear} onChange={event => setCustomAcademicYear(event.target.value)} placeholder="e.g. 2029-2030" required/></label>}
          <label className="setup-field">Are you just starting?<select value={startingFresh} onChange={event => setStartingFresh(event.target.value)} required><option value="">Choose one</option><option value="yes">Yes, I’m just starting</option><option value="no">No, I’m already in class</option></select></label>
          <label className="setup-field">Current grading period<select value={period} onChange={event => setPeriod(event.target.value)}>{PERIODS.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <div className="setup-section-title setup-subject-title"><span>03</span><div><b>Subjects and grading criteria</b><small>Set Written Works, Performance Tasks, and Examination weights for every subject. Defaults are 30 / 50 / 20 and each subject can be different.</small></div></div>
        <div className="setup-subject-add"><input value={subjectName} onChange={event => setSubjectName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSubject(subjectName); } }} placeholder="Type a subject name" aria-label="New subject name"/><button type="button" className="subtle-btn" onClick={() => addSubject(subjectName)}><Plus size={15}/> Add subject</button></div>
        <div className="setup-suggestions"><span>Quick add</span>{commonSubjects.map(subject => <button type="button" key={subject} disabled={subjects.some(item => item.name.toLowerCase() === subject.toLowerCase())} onClick={() => addSubject(subject)}>{subject}<Plus size={12}/></button>)}</div>
        {subjects.length>0&&<div className="setup-subject-list">{subjects.map((subject,index)=><details className="setup-subject-item" key={`${subject.name}-${index}`}><summary><span className="setup-subject-dot"/><b>{subject.name}</b><span className="setup-subject-template">WW {subject.weights.ww} · PT {subject.weights.pt} · Exam {subject.weights.exam}</span><button type="button" className="setup-remove" aria-label={`Remove ${subject.name}`} onClick={event=>{event.preventDefault();setSubjects(current=>current.filter((_,i)=>i!==index))}}><Trash2 size={15}/></button></summary><div className="setup-weight-fields">{([{key:'ww',label:'Written Works'},{key:'pt',label:'Performance Tasks'},{key:'exam',label:'Examination'}] as const).map(item=><label key={item.key}>{item.label}<span><input type="number" min="0" max="100" value={subject.weights[item.key]} onChange={event=>updateWeights(index,item.key,Number(event.target.value))}/>%</span></label>)}<b className={Object.values(subject.weights).reduce((sum,value)=>sum+value,0)===100?'weight-valid':'weight-invalid'}>{Object.values(subject.weights).reduce((sum,value)=>sum+value,0)}% total</b></div></details>)}</div>}
        {(formError||error)&&<p className="setup-error" role="alert">{formError||error}</p>}
        <div className="setup-actions"><span>{subjects.length} subject{subjects.length===1?'':'s'} selected</span><button className="primary-btn" type="submit" disabled={saving}>{saving?'Saving your setup…':'Save and open dashboard'}{!saving&&<ArrowRight size={16}/>}</button></div>
      </form>
      <p className="setup-footnote">Your profile, school setup, and subject criteria are saved to your account. No grades are created until you enter your own scores.</p>
    </section>
  </main>;
}

