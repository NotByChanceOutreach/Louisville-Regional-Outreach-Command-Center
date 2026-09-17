import { addDays, newId, todayKey } from './dates.ts';
import { addPersonToContact, archiveContactRecord, hydrateContact, markMethodInvalid, primaryPhone } from './contactModel.ts';
import {
  DEFAULT_SETTINGS,
  OUTCOME_TO_STATUS,
  type AnyCallOutcome,
  type ArchiveReason,
  type CallOutcome,
  type CommandCenterSnapshot,
  type Contact,
  type FollowUp,
  type FollowUpKind,
  type OrgPerson,
} from '../types/models.ts';
import type { PersonDraft } from './contactModel.ts';

export type CallOutcomeInput = {
  contactId: string;
  outcome: AnyCallOutcome;
  note?: string;
  followUpDate?: string;
  followUpKind?: FollowUpKind;
  actorName: string;
  actorUid?: string | null;
  now?: Date;
  declineMode?: 'permanent' | 'later';
  archiveReason?: ArchiveReason;
  archiveNotes?: string;
  newPerson?: PersonDraft;
  invalidMethodId?: string;
};

export type CallOutcomeResult = {
  contact: Contact;
  activityId: string;
  followUp: FollowUp | null;
  summary: string;
  needsNewPerson: boolean;
  needsDeclineMode: boolean;
  needsArchiveReason: boolean;
};

export function normalizeOutcome(outcome: AnyCallOutcome): CallOutcome | AnyCallOutcome {
  if (outcome === 'LEFT MESSAGE') return 'LEFT VOICEMAIL';
  if (outcome === 'SPOKE WITH SOMEONE') return 'SPOKE WITH PERSON';
  if (outcome === 'FOLLOW UP') return 'CALL BACK';
  if (outcome === 'DONE') return 'DONATION CONFIRMED';
  return outcome;
}

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

  const outcome = input.outcome;
  const normalized = normalizeOutcome(outcome);
  let next = hydrateContact(contact);
  let followUp: FollowUp | null = null;
  let status = OUTCOME_TO_STATUS[outcome];

  if (normalized === 'DECLINED' && input.declineMode === 'later') {
    status = 'Follow Up';
  }

  const followUpDate =
    normalized === 'CALL BACK' || (normalized === 'DECLINED' && input.declineMode === 'later')
      ? (input.followUpDate ?? addDays(todayKey(now), 1))
      : normalized === 'SEND EMAIL'
        ? (input.followUpDate ?? addDays(todayKey(now), 3))
        : null;

  if (normalized === 'WRONG NUMBER') {
    const methodId = input.invalidMethodId ?? primaryPhone(next)?.id;
    if (methodId) next = markMethodInvalid(next, methodId);
    status = 'Wrong Number';
  }

  if (normalized === 'GOT NEW CONTACT' && input.newPerson?.name) {
    next = addPersonToContact(next, { ...input.newPerson, isPrimary: true });
  }

  if (normalized === 'REMOVE FROM LIST') {
    next = archiveContactRecord(
      next,
      input.archiveReason ?? 'No Longer Relevant',
      input.archiveNotes ?? input.note ?? null,
      input.actorName,
      iso,
    );
    status = 'Archived';
  }

  const attempts = { ...next.attempts };
  attempts.total += 1;
  attempts.lastAttempted = iso;
  if (normalized === 'LEFT VOICEMAIL' || normalized === 'NO ANSWER' || normalized === 'WRONG NUMBER' || normalized === 'CALL BACK') {
    attempts.calls += 1;
  }
  if (normalized === 'SEND EMAIL') attempts.emails += 1;
  if (normalized === 'SPOKE WITH PERSON' || normalized === 'GOT NEW CONTACT' || normalized === 'INTERESTED' || normalized === 'DONATION POSSIBLE' || normalized === 'DONATION CONFIRMED') {
    attempts.calls += 1;
    attempts.conversations += 1;
    attempts.lastSuccessful = iso;
  }

  next = hydrateContact({
    ...next,
    status,
    lastContactAt: iso,
    nextFollowUpAt: followUpDate ?? (normalized === 'REMOVE FROM LIST' ? null : next.nextFollowUpAt),
    updatedAt: iso,
    updatedBy: input.actorName,
    updatedByUid: input.actorUid ?? null,
    attempts,
  });

  if (followUpDate) {
    followUp = {
      id: newId('fu'),
      contactId: next.id,
      taskId: null,
      title: `Follow up: ${next.organization}`,
      dueDate: followUpDate,
      dueTime: null,
      kind: input.followUpKind ?? 'once',
      status: 'open',
      notes: input.note ?? null,
      createdAt: iso,
      completedAt: null,
    };
    next = { ...next, status: 'Follow Up', nextFollowUpAt: followUpDate };
  }

  const summary = outcomeSummary(next.organization, outcome, input.note, followUpDate);
  return {
    contact: next,
    activityId: newId('act'),
    followUp,
    summary,
    needsNewPerson: normalized === 'GOT NEW CONTACT' && !input.newPerson?.name,
    needsDeclineMode: normalized === 'DECLINED' && !input.declineMode,
    needsArchiveReason: normalized === 'REMOVE FROM LIST' && !input.archiveReason,
  };
}

export function outcomeSummary(
  organization: string,
  outcome: AnyCallOutcome,
  note?: string,
  followUpDate?: string | null,
): string {
  const base: Record<AnyCallOutcome, string> = {
    'NO ANSWER': `No answer at ${organization}`,
    'LEFT VOICEMAIL': `Left voicemail at ${organization}`,
    'WRONG NUMBER': `Marked a wrong number at ${organization}`,
    'SPOKE WITH PERSON': `Spoke with someone at ${organization}`,
    'GOT NEW CONTACT': `Got a new contact at ${organization}`,
    'SEND EMAIL': `Email sent to ${organization}`,
    'CALL BACK': followUpDate
      ? `Follow-up scheduled with ${organization} for ${followUpDate}`
      : `Follow-up scheduled with ${organization}`,
    INTERESTED: `${organization} is interested`,
    DECLINED: `${organization} declined`,
    'DONATION POSSIBLE': `${organization} — donation possible`,
    'DONATION CONFIRMED': `${organization} — donation confirmed`,
    'REMOVE FROM LIST': `${organization} removed from the active list`,
    'LEFT MESSAGE': `Left message at ${organization}`,
    'SPOKE WITH SOMEONE': `Spoke with someone at ${organization}`,
    'FOLLOW UP': followUpDate
      ? `Follow-up scheduled with ${organization} for ${followUpDate}`
      : `Follow-up scheduled with ${organization}`,
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
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}

export function personLabel(person: OrgPerson): string {
  return [person.name, person.title, person.department].filter(Boolean).join(' · ');
}
