import type { ContactStatus, TaskPriority, TaskStatus } from '../types/models.ts';

export type Tone = 'red' | 'amber' | 'indigo' | 'emerald' | 'slate';

export function contactTone(status: ContactStatus, overdue = false): Tone {
  if (overdue) return 'red';
  switch (status) {
    case 'Call Today':
    case 'Follow Up':
    case 'Information Requested':
      return 'amber';
    case 'Called':
    case 'Left Message':
    case 'Email Sent':
    case 'Spoke With Someone':
    case 'Donation Request Submitted':
      return 'indigo';
    case 'Interested':
    case 'Partnership':
    case 'Completed':
    case 'Donation Possible':
    case 'Donation Confirmed':
      return 'emerald';
    case 'Wrong Number':
    case 'Unable to Reach':
    case 'Archived':
      return 'red';
    case 'Declined':
    case 'Not Contacted':
    default:
      return 'slate';
  }
}

export function taskTone(status: TaskStatus, priority: TaskPriority, overdue = false): Tone {
  if (status === 'Done') return 'emerald';
  if (status === 'Blocked' || overdue || priority === 'URGENT') return 'red';
  if (status === 'Working On It' || priority === 'HIGH') return 'amber';
  return 'indigo';
}

export const TONE_BADGE: Record<Tone, string> = {
  red: 'bg-red-100 text-red-800 border-red-200',
  amber: 'bg-amber-100 text-amber-900 border-amber-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const TONE_BAR: Record<Tone, string> = {
  red: 'border-l-red-600',
  amber: 'border-l-amber-500',
  indigo: 'border-l-indigo-600',
  emerald: 'border-l-emerald-600',
  slate: 'border-l-slate-300',
};

export const TONE_TEXT: Record<Tone, string> = {
  red: 'text-red-700',
  amber: 'text-amber-800',
  indigo: 'text-indigo-700',
  emerald: 'text-emerald-700',
  slate: 'text-slate-600',
};
