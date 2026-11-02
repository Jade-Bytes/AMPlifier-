import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useSound } from '../../lib/preferences';
import type { GradeSource, TermGrade } from '../../types/app';

export const fmtGrade = (value: number | null | undefined, digits = 1) => value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);

/** An id usable inside SVG url(#…) references (React ids contain characters that are not). */
export const useSvgId = (prefix: string) => `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

const SOURCE_HINT: Record<GradeSource, string> = {
  Actual: 'Official report-card grade you entered',
  Estimated: 'Calculated from your recorded assessments',
  Projected: 'Your assumption for a term without data',
};

/** Small label that always states where a grade came from (never colour alone). */
export function SourceBadge({ source, compact = false }: { source: GradeSource; compact?: boolean }) {
  return <span className={`source-badge source-${source.toLowerCase()}`} title={SOURCE_HINT[source]}>{compact ? source.slice(0, 3) : source}</span>;
}

export function TermGradeCell({ entry, passingGrade }: { entry: TermGrade | null; passingGrade?: number }) {
  if (!entry) return <span className="grade-empty" aria-label="No grade">—</span>;
  const below = passingGrade !== undefined && entry.grade < passingGrade;
  return <span className={`term-grade term-${entry.source.toLowerCase()}`}>
    <strong className={below ? 'is-below' : ''}>{entry.grade.toFixed(1)}</strong>
    <SourceBadge source={entry.source} compact/>
  </span>;
}

export function SubjectDot({ color, size = 9 }: { color: string; size?: number }) {
  return <span className="subject-dot" style={{ background: color, width: size, height: size, '--dot': color } as CSSProperties} aria-hidden="true"/>;
}

export function Delta({ value, unit = '' }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return <span className="delta delta-none">—</span>;
  const rounded = Number(value.toFixed(1));
  const tone = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
  return <span className={`delta delta-${tone}`}>{rounded > 0 ? '▲' : rounded < 0 ? '▼' : '•'} {Math.abs(rounded).toFixed(1)}{unit}<span className="sr-only">{rounded > 0 ? ' increase' : rounded < 0 ? ' decrease' : ' no change'}</span></span>;
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state">
    {icon && <span className="empty-state-icon">{icon}</span>}
    <b>{title}</b>
    {children && <p>{children}</p>}
    {action}
  </div>;
}

export function Panel({ title, description, actions, children, className = '', id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return <section className={`card ${className}`} id={id}>
    {(title || actions) && <header className="card-header">
      <div>{title && <h2 className="card-title">{title}</h2>}{description && <p className="card-description">{description}</p>}</div>
      {actions && <div className="card-actions">{actions}</div>}
    </header>}
    {children}
  </section>;
}

/** Segmented control. A thumb slides to the chosen option; the buttons stay real toggle buttons. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  const group = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const play = useSound();

  useLayoutEffect(() => {
    const node = group.current;
    if (!node) return;
    const measure = () => {
      const active = node.querySelector<HTMLElement>('button[aria-pressed=true]');
      setThumb(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, options.length]);

  return <div ref={group} className={`segmented ${thumb ? 'has-thumb' : ''}`} role="group" aria-label={label}>
    {thumb && <span className="segmented-thumb" style={{ left: thumb.left, width: thumb.width }} aria-hidden="true"/>}
    {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} className={value === option.value ? 'is-active' : ''} onClick={() => { if (option.value !== value) play('select'); onChange(option.value); }}>{option.label}</button>)}
  </div>;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  const play = useSound();
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled}
    onClick={() => { play(checked ? 'toggleOff' : 'toggleOn'); onChange(!checked); }}/>;
}

/**
 * Circular gauge for a 0–100 grade. The arc covers `min`–100 so differences that matter
 * (80 vs 90) are visible; `target` adds an amber tick. Decorative: pair it with the number.
 */
export function RingGauge({ value, target, min = 60, size = 46, stroke = 5, label }: { value: number | null; target?: number | null; min?: number; size?: number; stroke?: number; label?: string }) {
  const id = useSvgId('ring');
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = (grade: number) => Math.max(0, Math.min(1, (grade - min) / (100 - min)));
  const [shown, setShown] = useState(0);
  // Start empty and sweep to the value so the arc visibly fills on arrival.
  useLayoutEffect(() => { const frame = requestAnimationFrame(() => setShown(value === null ? 0 : fraction(value))); return () => cancelAnimationFrame(frame); }, [value, min]);
  const tick = target === null || target === undefined ? null : fraction(target) * 2 * Math.PI;
  const c = size / 2;
  return <span className="ring" style={{ width: size, height: size }} aria-hidden="true">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--signal)"/><stop offset="100%" stopColor="var(--gain)"/></linearGradient></defs>
      <circle className="ring-track" cx={c} cy={c} r={radius} fill="none" strokeWidth={stroke}/>
      <circle className="ring-value" cx={c} cy={c} r={radius} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown)}/>
      {tick !== null && <line className="ring-target" x1={c + (radius - stroke) * Math.cos(tick)} y1={c + (radius - stroke) * Math.sin(tick)} x2={c + (radius + stroke) * Math.cos(tick)} y2={c + (radius + stroke) * Math.sin(tick)} strokeWidth={2.5} strokeLinecap="round"/>}
    </svg>
    {label && <span className="ring-label">{label}</span>}
  </span>;
}
