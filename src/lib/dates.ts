const TIME_ZONE = 'America/New_York';

const dateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const displayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const stampFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function partsMap(date: Date, fmt: Intl.DateTimeFormat): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = part.value;
  }
  return out;
}

/** YYYY-MM-DD in Louisville local time. */
export function todayKey(now: Date = new Date()): string {
  const parts = partsMap(now, dateFmt);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOverdue(dateKey: string | null | undefined, now: Date = new Date()): boolean {
  if (!dateKey) return false;
  return dateKey < todayKey(now);
}

export function isDueToday(dateKey: string | null | undefined, now: Date = new Date()): boolean {
  if (!dateKey) return false;
  return dateKey === todayKey(now);
}

export function formatDateKey(dateKey: string | null | undefined): string {
  if (!dateKey) return NEEDS_RESEARCH_DATE;
  const [year, month, day] = dateKey.split('-').map(Number);
  const approx = new Date(year, month - 1, day, 12);
  return displayFmt.format(approx);
}

export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return NEEDS_RESEARCH_DATE;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return NEEDS_RESEARCH_DATE;
  return stampFmt.format(date);
}

export function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const NEEDS_RESEARCH_DATE = 'Needs Research';
