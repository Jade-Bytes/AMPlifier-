import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Download, FileText, FileUp, HardDrive, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { connectGoogleDrive, deleteDriveAttachment, deleteUserNote, downloadNoteAttachment, saveUserNote, subscribeUserNotes, uploadNoteAttachment } from '../services/firebase';
import type { AcademicNote } from '../types/app';
import { useFeedback } from './ui/Feedback';

type Props = { uid: string; subjects: string[]; academicYear: string; currentPeriod: string; demo?: boolean };
const periodOptions = ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4', 'Semester 1', 'Semester 2'];
const maxTextLength = 80000;
const maxAttachmentBytes = 25 * 1024 * 1024;
function emptyNote(subjects: string[], academicYear: string, currentPeriod: string): AcademicNote {
  return { id: '', title: '', subject: subjects[0] ?? '', period: currentPeriod, academicYear: academicYear || '2026-2027', content: '', fileName: '', fileType: '', fileData: '', createdAt: Date.now(), updatedAt: Date.now() };
}
function extension(name: string) { return name.split('.').pop()?.toLowerCase() ?? ''; }
function formatDate(value: number) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }

export default function NotesView({ uid, subjects, academicYear, currentPeriod, demo = false }: Props) {
  const [notes, setNotes] = useState<AcademicNote[]>([]);
  const [draft, setDraft] = useState<AcademicNote>(() => emptyNote(subjects, academicYear, currentPeriod));
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All subjects');
  const [periodFilter, setPeriodFilter] = useState('All periods');
  const [activeNote, setActiveNote] = useState<AcademicNote|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [driveReady, setDriveReady] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [docxHtml, setDocxHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const { confirm, notify } = useFeedback();

  useEffect(() => {
    if (demo) {
      setNotes([{ id: 'demo-note', title: 'How to organize class notes', subject: subjects[0] ?? 'Mathematics', period: currentPeriod, academicYear: academicYear || '2026-2027', content: 'Use one note per topic. Add a clear title and keep formulas, examples, and questions together so they are easy to review before a quiz.', createdAt: Date.now(), updatedAt: Date.now() }]);
      return;
    }
    return subscribeUserNotes(uid, setNotes, err => setError(err.message || 'Could not load your notes.'));
  }, [uid, demo, subjects, currentPeriod, academicYear]);

  const visibleNotes = useMemo(() => notes.filter(note => {
    const matchesSearch = `${note.title} ${note.subject} ${note.period} ${note.academicYear} ${note.content} ${note.fileName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (subjectFilter === 'All subjects' || note.subject === subjectFilter) && (periodFilter === 'All periods' || note.period === periodFilter);
  }).sort((a, b) => b.updatedAt - a.updatedAt), [notes, search, subjectFilter, periodFilter]);

  function startNew() { setDraft(emptyNote(subjects, academicYear, currentPeriod)); setAttachmentFile(null); setEditing(true); setError(''); }
  function editNote(note: AcademicNote) { setDraft({ ...note }); setAttachmentFile(null); setEditing(true); setError(''); }
  function cancelEdit() { setEditing(false); setDraft(emptyNote(subjects, academicYear, currentPeriod)); setAttachmentFile(null); setError(''); if (fileInput.current) fileInput.current.value = ''; }
  async function importFile(file?: File) {
    if (!file) return;
    const ext = extension(file.name);
    const textExtensions = ['txt', 'md', 'csv'];
    const binaryTypes: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    if (![...textExtensions, ...Object.keys(binaryTypes)].includes(ext)) { setError('Import a .txt, .md, .csv, .pdf, or .docx file.'); return; }
    if (file.size > maxAttachmentBytes) { setError('Google Drive note attachments are limited to 25 MB per file.'); return; }
    setError('');
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (textExtensions.includes(ext)) {
      const text = await file.text();
      if (text.length > maxTextLength) { setError(`Text notes are limited to ${maxTextLength.toLocaleString()} characters.`); return; }
      setDraft(current => ({ ...current, title: current.title || title, content: text, fileName: '', fileType: '', fileData: '', driveFileId: '' })); setAttachmentFile(null);
      return;
    }
    setDraft(current => ({ ...current, title: current.title || title, content: '', fileName: file.name, fileType: binaryTypes[ext], fileData: '', driveFileId: '' })); setAttachmentFile(file);
  }

  async function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title || !draft.subject) { setError('Add a title and choose a subject.'); return; }
    if (!draft.content.trim() && !draft.fileData && !draft.driveFileId && !attachmentFile) { setError('Write some notes or import a file first.'); return; }
    if (draft.content.length > maxTextLength) { setError(`Notes are limited to ${maxTextLength.toLocaleString()} characters.`); return; }
    const now = Date.now();
    let uploadedDriveId = '';
    const note: AcademicNote = { ...draft, id: draft.id || `note-${now}`, title, createdAt: draft.createdAt || now, updatedAt: now };
    setBusy(true); setError('');
    try {
      if (demo) setNotes(current => [note, ...current.filter(item => item.id !== note.id)]);
      else {
        if (attachmentFile) { uploadedDriveId = await uploadNoteAttachment(uid, note.id, attachmentFile); note.driveFileId = uploadedDriveId; note.fileData = ''; }
        await saveUserNote(uid, note);
        if (uploadedDriveId && draft.driveFileId && draft.driveFileId !== uploadedDriveId) await deleteDriveAttachment(uid, draft.driveFileId);
        setDriveReady(Boolean(note.driveFileId) || driveReady);
      }
      setEditing(false); setDraft(emptyNote(subjects, academicYear, currentPeriod));
      setAttachmentFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (reason) { if (uploadedDriveId) await deleteDriveAttachment(uid, uploadedDriveId).catch(() => undefined); setError(reason instanceof Error ? reason.message : 'Could not save this note.'); }
    finally { setBusy(false); }
  }

  async function removeNote(note: AcademicNote) {
    if (!await confirm({ title: `Delete “${note.title}”?`, message: note.driveFileId ? 'The note and its attached file in your Google Drive AMPlifier Notes folder will be deleted.' : 'This note will be permanently deleted.', confirmLabel: 'Delete note', destructive: true })) return;
    try { if (demo) setNotes(current => current.filter(item => item.id !== note.id)); else { await deleteUserNote(uid, note.id); if (note.driveFileId) await deleteDriveAttachment(uid, note.driveFileId); } if (activeNote?.id === note.id) setActiveNote(null); notify('Note deleted'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete this note.'); }
  }

  async function openNote(note: AcademicNote) {
    setActiveNote(note); setAttachmentUrl(''); setDocxHtml(''); setPreviewError('');
    if (!note.driveFileId && !note.fileData) return;
    setLoadingAttachment(true);
    try {
      const blob = note.driveFileId ? await downloadNoteAttachment(uid, note.driveFileId) : await fetch(note.fileData!).then(response => response.blob());
      setAttachmentUrl(URL.createObjectURL(blob));
      if (note.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const [{ convertToHtml }, { default: DOMPurify }] = await Promise.all([import('mammoth'), import('dompurify')]);
        const result = await convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        setDocxHtml(DOMPurify.sanitize(result.value, { USE_PROFILES: { html: true } }));
      }
    } catch (reason) { setPreviewError(reason instanceof Error ? reason.message : 'Could not preview this attachment.'); }
    finally { setLoadingAttachment(false); }
  }

  useEffect(() => () => { if (attachmentUrl) URL.revokeObjectURL(attachmentUrl); }, [attachmentUrl]);

  return <div className={`notes-page ${editing ? 'is-editing' : ''}`}>
    <section className="panel notes-library"><div className="panel-heading"><div><h2>Notes library</h2><p>Keep notes organized by subject, grading period, and academic year.</p></div><div className="notes-library-actions"><button className="subtle-btn" onClick={()=>void connectGoogleDrive(uid).then(()=>setDriveReady(true)).catch(reason=>setError(reason instanceof Error?reason.message:'Could not connect Google Drive.'))}><HardDrive size={15}/>{driveReady?'Drive connected':'Connect Drive'}</button><button className="primary-btn" onClick={startNew}><Plus size={16}/> New note</button></div></div>
      <div className="notes-filters"><label className="notes-search"><Search size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search note titles and content" aria-label="Search notes"/></label><select aria-label="Filter notes by subject" value={subjectFilter} onChange={event=>setSubjectFilter(event.target.value)}><option>All subjects</option>{subjects.map(subject=><option key={subject}>{subject}</option>)}</select><select aria-label="Filter notes by period" value={periodFilter} onChange={event=>setPeriodFilter(event.target.value)}><option>All periods</option>{periodOptions.map(period=><option key={period}>{period}</option>)}</select></div>
      {error&&<p className="notes-error" role="alert">{error}</p>}
      {visibleNotes.length===0?<div className="notes-empty"><span><BookOpen size={22}/></span><b>{notes.length?'No notes match these filters':'Start your notes library'}</b><p>{notes.length?'Try another search, subject, or term.':'Write a note or import a text, Markdown, CSV, PDF, or Word document.'}</p>{!notes.length&&<button className="subtle-btn" onClick={startNew}><Plus size={14}/> Create your first note</button>}</div>:<div className="notes-list">{visibleNotes.map(note=><article className="note-row" key={note.id}><span className="note-type-icon">{note.fileData||note.driveFileId?<FileText size={17}/>:<BookOpen size={17}/>}</span><button className="note-main" onClick={()=>void openNote(note)}><b>{note.title}</b><span>{note.subject} · {note.period} · {note.academicYear}</span><small>{note.fileName||note.content.trim().slice(0,115)||'Attached document'}{!note.fileName&&note.content.trim().length>115?'…':''}</small></button><span className="note-updated">{formatDate(note.updatedAt)}</span><button className="icon-btn small-icon" aria-label={`Edit ${note.title}`} onClick={()=>editNote(note)}><Pencil size={14}/></button><button className="icon-btn small-icon delete-assessment" aria-label={`Delete ${note.title}`} onClick={()=>void removeNote(note)}><Trash2 size={14}/></button></article>)}</div>}
    </section>
    {editing&&<section className="panel note-editor"><div className="panel-heading"><div><h2>{draft.id?'Edit note':'New note'}</h2><p>Notes are private to your account.</p></div><button className="icon-btn" aria-label="Close note editor" onClick={cancelEdit}><X size={17}/></button></div><form onSubmit={event=>void saveNote(event)}><label>Title<input value={draft.title} maxLength={160} onChange={event=>setDraft(current=>({...current,title:event.target.value}))} placeholder="e.g. Cell structure review" required/></label><label>Subject<select value={draft.subject} onChange={event=>setDraft(current=>({...current,subject:event.target.value}))} required>{subjects.map(subject=><option key={subject}>{subject}</option>)}</select></label><div className="notes-meta-fields"><label>Quarter or semester<select value={draft.period} onChange={event=>setDraft(current=>({...current,period:event.target.value}))}>{periodOptions.map(period=><option key={period}>{period}</option>)}</select></label><label>Academic year<input value={draft.academicYear} maxLength={20} onChange={event=>setDraft(current=>({...current,academicYear:event.target.value}))}/></label></div><label>Note content<textarea value={draft.content} maxLength={maxTextLength} onChange={event=>setDraft(current=>({...current,content:event.target.value}))} placeholder="Type or paste your notes here…" rows={10}/></label><div className="note-import"><input ref={fileInput} type="file" accept=".txt,.md,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event=>void importFile(event.target.files?.[0])}/><div><b>{attachmentFile?.name||draft.fileName||'Import a file'}</b><small>.txt, .md, .csv, .pdf, or .docx · max 25 MB · documents stored in Google Drive</small></div><button type="button" className="subtle-btn" onClick={()=>fileInput.current?.click()}><FileUp size={15}/> Choose file</button>{(draft.fileData||draft.driveFileId||attachmentFile)&&<button type="button" className="icon-btn" aria-label="Remove attached file" onClick={()=>{setAttachmentFile(null);setDraft(current=>({...current,fileName:'',fileType:'',fileData:'',driveFileId:''}));if(fileInput.current)fileInput.current.value=''}}><X size={15}/></button>}</div><div className="note-editor-footer"><span>{draft.content.length.toLocaleString()} / {maxTextLength.toLocaleString()} characters</span><button className="primary-btn" type="submit" disabled={busy}>{busy?'Saving…':'Save note'} <Check size={14}/></button></div></form></section>}
    {activeNote&&<div className="modal-scrim notes-viewer-scrim" onClick={()=>setActiveNote(null)}><section className="notes-viewer" role="dialog" aria-modal="true" aria-labelledby="note-view-title" onClick={event=>event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">{activeNote.subject} · {activeNote.period} · {activeNote.academicYear}</div><h2 id="note-view-title">{activeNote.title}</h2></div><button className="icon-btn" aria-label="Close note" onClick={()=>setActiveNote(null)}><X size={18}/></button></div>{loadingAttachment?<p className="notes-empty">Opening attachment…</p>:previewError?<div className="note-document-download"><FileText size={28}/><b>Preview unavailable</b><span>{previewError}</span>{(attachmentUrl||activeNote.fileData)&&<a className="subtle-btn" href={attachmentUrl||activeNote.fileData} download={activeNote.fileName}><Download size={15}/> Download original</a>}</div>:activeNote.fileType==='application/pdf'&&(attachmentUrl||activeNote.fileData)?<iframe className="note-pdf-viewer" title={activeNote.fileName||activeNote.title} src={attachmentUrl||activeNote.fileData}/>:activeNote.fileType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'&&docxHtml?<><div className="note-docx-toolbar"><span>Word document preview</span>{attachmentUrl&&<a className="subtle-btn" href={attachmentUrl} download={activeNote.fileName}><Download size={14}/> Download original</a>}</div><article className="note-docx-preview" dangerouslySetInnerHTML={{__html:docxHtml}}/></>:activeNote.content?<pre className="note-content-preview">{activeNote.content}</pre>:<div className="note-document-download"><FileText size={28}/><b>{activeNote.fileName}</b><span>Private attachment in your Google Drive AMPlifier Notes folder.</span>{(attachmentUrl||activeNote.fileData)&&<a className="subtle-btn" href={attachmentUrl||activeNote.fileData} download={activeNote.fileName}><Download size={15}/> Download document</a>}</div>}</section></div>}
  </div>;
}
