const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}

/** Today in the user's local timezone as YYYY-MM-DD. */
export function todayISO(now = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Best-effort conversion of legacy labels such as "Nov 06" to an ISO date; falls back to today. */
export function toISODate(value: string | undefined): string {
  if (isISODate(value)) return value;
  if (!value) return todayISO();
  const parsed = new Date(`${value} ${new Date().getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? todayISO() : todayISO(parsed);
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  return isISODate(value) ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', options) : value;
}

/** Whole days from today until `iso` (negative when in the past). */
export function daysUntil(iso: string, today = todayISO()): number {
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

export function relativeDay(iso: string, today = todayISO()): string {
  const days = daysUntil(iso, today);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `In ${days} days`;
  return formatDate(iso, { month: 'short', day: 'numeric' });
}
