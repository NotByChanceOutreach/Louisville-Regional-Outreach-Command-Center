import { addDays, newId, todayKey } from './dates.ts';
import { OUTCOME_TO_STATUS, type CallOutcome, type CommandCenterSnapshot, type Contact, type FollowUp } from '../types/models.ts';

export type CallOutcomeInput = {
  contactId: string;
  outcome: CallOutcome;
  note?: string;
  followUpDate?: string;
  actorName: string;
  now?: Date;
};

export type CallOutcomeResult = {
  contact: Contact;
  activityId: string;
  followUp: FollowUp | null;
  summary: string;
};

export function applyCallOutcome(
  snapshot: CommandCenterSnapshot,
  input: CallOutcomeInput,
): CallOutcomeResult {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const contact = snapshot.contacts.find((item) => item.id === input.contactId);
  if (!contact) {
    throw new Error('Contact not found.');
  }

  const status = OUTCOME_TO_STATUS[input.outcome];
  const followUpDate =
    input.outcome === 'FOLLOW UP' ? (input.followUpDate ?? addDays(todayKey(now), 1)) : null;

  const updated: Contact = {
    ...contact,
    status,
    lastContactAt: iso,
    nextFollowUpAt: followUpDate,
    updatedAt: iso,
  };

  const summary = outcomeSummary(contact.organization, input.outcome, input.note, followUpDate);
  const activityId = newId('act');

  const followUp: FollowUp | null = followUpDate
    ? {
        id: newId('fu'),
        contactId: contact.id,
        taskId: null,
        title: `Follow up: ${contact.organization}`,
        dueDate: followUpDate,
        status: 'open',
        notes: input.note ?? null,
        createdAt: iso,
        completedAt: null,
      }
    : null;

  return { contact: updated, activityId, followUp, summary };
}

export function outcomeSummary(
  organization: string,
  outcome: CallOutcome,
  note?: string,
  followUpDate?: string | null,
): string {
  const base: Record<CallOutcome, string> = {
    'LEFT MESSAGE': `Left message at ${organization}`,
    'SPOKE WITH SOMEONE': `Spoke with someone at ${organization}`,
    'SEND EMAIL': `Email sent to ${organization}`,
    'FOLLOW UP': followUpDate
      ? `Follow-up scheduled with ${organization} for ${followUpDate}`
      : `Follow-up scheduled with ${organization}`,
    DECLINED: `${organization} declined`,
    INTERESTED: `${organization} is interested`,
    DONE: `Completed outreach with ${organization}`,
  };
  if (note && note.trim()) return `${base[outcome]}. ${note.trim()}`;
  return base[outcome];
}

export function todayTasks(tasks: CommandCenterSnapshot['tasks']): CommandCenterSnapshot['tasks'] {
  return tasks.filter((task) => task.status !== 'Done').sort((a, b) => a.sortOrder - b.sortOrder);
}

export function completedTasks(tasks: CommandCenterSnapshot['tasks']): CommandCenterSnapshot['tasks'] {
  return tasks
    .filter((task) => task.status === 'Done')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
}

export function reorder<T extends { id: string; sortOrder: number }>(
  items: readonly T[],
  id: string,
  direction: 'up' | 'down',
): T[] {
  const sorted = items.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sorted.findIndex((item) => item.id === id);
  if (index < 0) return sorted;
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return sorted;
  const copy = sorted.slice();
  const current = copy[index];
  copy[index] = copy[swapWith];
  copy[swapWith] = current;
  return copy.map((item, sortOrder) => ({ ...item, sortOrder }));
}

export function emptySnapshot(): CommandCenterSnapshot {
  return {
    tasks: [],
    contacts: [],
    contactActivity: [],
    followUps: [],
    boardTasks: [],
    activity: [],
    settings: {
      seededAt: null,
      resourceProgress: {
        remaining: 0,
        contacted: 0,
        verified: 0,
        needsFollowUp: 0,
        unableToReach: 0,
      },
      resourceVerifierUrl: 'https://next-chance-navigator-staging.web.app/verify/',
      navigatorUrl: 'https://next-chance-navigator.web.app/navigator/',
    },
  };
}
