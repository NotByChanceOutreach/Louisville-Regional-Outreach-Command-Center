import { addDays, todayKey } from './dates.ts';
import type { FollowUp, FollowUpKind, FollowUpIntervalSettings } from '../types/models.ts';
import { DEFAULT_FOLLOW_UP_INTERVALS } from '../types/models.ts';

export type FollowUpPreset =
  | 'today'
  | 'tomorrow'
  | 'three_days'
  | 'week'
  | 'two_weeks'
  | 'thirty'
  | 'next_month'
  | 'next_quarter'
  | 'seasonal'
  | 'annual'
  | 'choose';

export const FOLLOW_UP_PRESETS: { id: FollowUpPreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'three_days', label: '3 Days' },
  { id: 'week', label: '1 Week' },
  { id: 'two_weeks', label: '2 Weeks' },
  { id: 'thirty', label: '30 Days' },
  { id: 'next_month', label: 'Try Again Next Month' },
  { id: 'next_quarter', label: 'Try Again Next Quarter' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'annual', label: 'Annual Request' },
  { id: 'choose', label: 'Choose Date' },
];

export function dateForPreset(
  preset: FollowUpPreset,
  now: Date = new Date(),
  intervals: FollowUpIntervalSettings = DEFAULT_FOLLOW_UP_INTERVALS,
  chosen?: string,
): { dueDate: string; kind: FollowUpKind } {
  const today = todayKey(now);
  switch (preset) {
    case 'today':
      return { dueDate: today, kind: 'once' };
    case 'tomorrow':
      return { dueDate: addDays(today, intervals.tomorrow), kind: 'once' };
    case 'three_days':
      return { dueDate: addDays(today, intervals.threeDays), kind: 'once' };
    case 'week':
      return { dueDate: addDays(today, intervals.week), kind: 'once' };
    case 'two_weeks':
      return { dueDate: addDays(today, intervals.twoWeeks), kind: 'once' };
    case 'thirty':
      return { dueDate: addDays(today, intervals.thirty), kind: 'once' };
    case 'next_month':
      return { dueDate: addDays(today, 30), kind: 'next_month' };
    case 'next_quarter':
      return { dueDate: addDays(today, 90), kind: 'next_quarter' };
    case 'seasonal':
      return { dueDate: addDays(today, 120), kind: 'seasonal' };
    case 'annual':
      return { dueDate: addDays(today, 365), kind: 'annual' };
    case 'choose':
      return { dueDate: chosen || addDays(today, 1), kind: 'once' };
    default:
      return { dueDate: addDays(today, 1), kind: 'once' };
  }
}

export function nextRecurrence(followUp: FollowUp, fromDate: string): { dueDate: string; kind: FollowUpKind } | null {
  switch (followUp.kind) {
    case 'next_month':
      return { dueDate: addDays(fromDate, 30), kind: 'next_month' };
    case 'next_quarter':
      return { dueDate: addDays(fromDate, 90), kind: 'next_quarter' };
    case 'seasonal':
      return { dueDate: addDays(fromDate, 120), kind: 'seasonal' };
    case 'annual':
      return { dueDate: addDays(fromDate, 365), kind: 'annual' };
    default:
      return null;
  }
}

export function partitionFollowUps(followUps: readonly FollowUp[], now: Date = new Date()) {
  const today = todayKey(now);
  const open = followUps.filter((item) => item.status === 'open');
  const overdue = open.filter((item) => item.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueToday = open.filter((item) => item.dueDate === today).sort((a, b) => (a.dueTime ?? '').localeCompare(b.dueTime ?? ''));
  const upcoming = open
    .filter((item) => item.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '').localeCompare(b.dueTime ?? ''));
  return { overdue, dueToday, upcoming };
}
