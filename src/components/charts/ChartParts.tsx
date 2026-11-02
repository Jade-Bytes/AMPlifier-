import type { ReactNode } from 'react';

type Payload = { type?: string; name?: string; value?: number | string; color?: string; stroke?: string; payload?: Record<string, unknown>; dataKey?: string | number };

type TooltipProps = {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
  /** Heading for the tooltip; defaults to the category label. */
  title?: (label: string | number | undefined, payload: Payload[]) => ReactNode;
  /** Row label for a series (by dataKey). */
  names?: Record<string, string>;
  /** Extra lines under the rows. */
  footer?: (payload: Payload[]) => ReactNode;
  digits?: number;
};

/** Glass tooltip shared by every chart: series swatch, name, and the value in display type. */
export function ChartTooltip({ active, payload, label, title, names = {}, footer, digits = 1 }: TooltipProps) {
  // Decorative series (gradient fills) are marked tooltipType="none" and never listed.
  const rows = (payload ?? []).filter(entry => entry.type !== 'none' && entry.value !== null && entry.value !== undefined);
  if (!active || !rows.length) return null;
  return <div className="chart-tooltip glass-float">
    <b>{title ? title(label, rows) : label}</b>
    {rows.map(entry => <span className="chart-tooltip-row" key={String(entry.dataKey)}>
      <i style={{ background: entry.stroke ?? entry.color }}/>{names[String(entry.dataKey)] ?? entry.name}
      <strong>{typeof entry.value === 'number' ? entry.value.toFixed(digits) : entry.value}</strong>
    </span>)}
    {footer?.(rows)}
  </div>;
}

/** Vertical fade used under line charts: the series colour at the top, transparent at the base. */
export function AreaFade({ id, color, opacity = .32 }: { id: string; color: string; opacity?: number }) {
  return <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor={color} stopOpacity={opacity}/>
    <stop offset="100%" stopColor={color} stopOpacity={0}/>
  </linearGradient>;
}
