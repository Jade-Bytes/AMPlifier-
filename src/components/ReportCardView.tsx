import { Printer } from 'lucide-react';
import { SubjectDot, TermGradeCell, fmtGrade } from './ui/primitives';
import { useRevealCue } from './ui/motion';
import { mean, termAverages, type ReportCardRow } from '../engine/reportCard';
import type { AcademicProfile } from '../types/app';

type Props = {
  profile: AcademicProfile | null;
  terms: string[];
  rows: ReportCardRow[];
  passingGrade: number;
  gradingScale: 'percentage' | 'deped';
  yearToDate: number | null;
  onGoToGrades: () => void;
};

export default function ReportCardView({ profile, terms, rows, passingGrade, gradingScale, yearToDate, onGoToGrades }: Props) {
  const hasGrades = rows.some(row => row.terms.some(Boolean));
  useRevealCue(260);
  const columns = termAverages(rows, terms.length);
  const finals = rows.map(row => {
    const filled = row.terms.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return { value: mean(filled.map(entry => entry.grade)), complete: filled.length === terms.length, projected: filled.some(entry => entry.source === 'Projected') };
  });
  const generalFinal = mean(finals.map(final => final.value).filter((value): value is number => value !== null));
  const finalPartial = finals.some(final => !final.complete);
  const finalProjected = finals.some(final => final.projected);

  return <section className="card report-sheet">
    <header className="report-header">
      <div>
        <span className="report-kicker">Academic record · unofficial</span>
        <h2>{profile?.schoolName || 'Student report card'}</h2>
        <p>Grades recorded in AMPlifier for {profile?.academicYear || 'this academic year'}.</p>
      </div>
      <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}><Printer size={15}/> Print / save PDF</button>
    </header>
    <dl className="report-student">
      <div><dt>Student</dt><dd>{profile?.displayName || 'Student'}</dd></div>
      <div><dt>Grade &amp; section</dt><dd>{[profile?.gradeLevel, profile?.section].filter(Boolean).join(' · ') || '—'}</dd></div>
      <div><dt>School year</dt><dd>{profile?.academicYear || '—'}</dd></div>
      <div><dt>Year-to-date average</dt><dd>{fmtGrade(yearToDate)}</dd></div>
    </dl>
    {!hasGrades ? <div className="empty-state"><b>Your report card is waiting for grades</b><p>Enter official report-card grades or record assessment scores in the Gradebook.</p><button className="btn btn-secondary btn-sm" onClick={onGoToGrades}>Open Gradebook</button></div> : <>
      <div className="table-scroll" role="region" aria-label="Report card grades by subject and term" tabIndex={0}>
        <table className="data-table report-table">
          <thead><tr><th scope="col">Learning area</th>{terms.map(term => <th scope="col" className="num" key={term}>{term}</th>)}<th scope="col" className="num">Final</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.subject.id}>
            <th scope="row"><SubjectDot color={row.subject.color}/> {row.subject.name}</th>
            {row.terms.map((entry, termIndex) => <td className="num" key={terms[termIndex]}><TermGradeCell entry={entry} passingGrade={passingGrade}/></td>)}
            <td className="num"><strong>{fmtGrade(finals[index].value)}</strong>{finals[index].value !== null && (!finals[index].complete || finals[index].projected) && <small className="text-faint">{!finals[index].complete ? ' partial' : ' incl. proj.'}</small>}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row">General average</th>
            {columns.map((column, index) => <td className="num" key={terms[index]}><strong>{fmtGrade(column.average)}</strong>{column.average !== null && column.usesProjection && <small className="text-faint"> incl. proj.</small>}</td>)}
            <td className="num"><strong>{fmtGrade(generalFinal)}</strong>{generalFinal !== null && (finalPartial || finalProjected) && <small className="text-faint">{finalPartial ? ' partial' : ' incl. proj.'}</small>}</td>
          </tr></tfoot>
        </table>
      </div>
      <div className="report-legend"><span><span className="source-badge source-actual">Act</span> Actual — official grade you entered</span><span><span className="source-badge source-estimated">Est</span> Estimated from recorded scores{gradingScale === 'deped' ? ' (DepEd transmuted)' : ''}</span><span><span className="source-badge source-projected">Pro</span> Projected — your assumption</span></div>
      <p className="card-footnote">Blank cells have no grade yet and are not counted. Final = average of the available term grades. Estimates and projections are not official grades.</p>
    </>}
  </section>;
}
