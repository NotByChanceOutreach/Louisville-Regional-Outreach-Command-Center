import { formatStamp, isDueToday, isOverdue } from './dates.ts';
import { activeContacts, isActiveContact, primaryPhone } from './contactModel.ts';
import { partitionFollowUps } from './followUpSchedule.ts';
import { callQueue } from './nextContact.ts';
import { needsReverification } from './verification.ts';
import type { CommandCenterSnapshot, Contact, PinKey, Task } from './whatNextTypes.ts';
import type { Tone } from './status.ts';

export type RankedAction = {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  why: string;
  href: string;
  actionLabel: string;
  contactId: string | null;
  phone: string | null;
  rank: number;
};

function pinned(tasks: readonly Task[], key: PinKey): Task | undefined {
  return tasks.find((task) => task.pinKey === key);
}

function callAction(contact: Contact, why: string, rank: number, tone: Tone): RankedAction {
  const phone = primaryPhone(contact)?.value ?? contact.phone;
  return {
    id: `contact-${contact.id}-${rank}`,
    tone,
    title: `CALL ${contact.organization.toUpperCase()}`,
    detail: contact.lastContactAt
      ? `Last contact: ${formatStamp(contact.lastContactAt)}`
      : contact.contactName
        ? `Ask for ${contact.contactName}`
        : 'No previous contact logged.',
    why,
    href: `/calls/${contact.id}`,
    actionLabel: phone ? 'Call now' : 'Open contact',
    contactId: contact.id,
    phone,
    rank,
  };
}

export function rankNextActions(snapshot: CommandCenterSnapshot, now: Date = new Date()): RankedAction[] {
  const actions: RankedAction[] = [];
  const seenContacts = new Set<string>();
  const active = activeContacts(snapshot.contacts);
  const { overdue, dueToday } = partitionFollowUps(snapshot.followUps, now);

  const pushContact = (contact: Contact | undefined, why: string, rank: number, tone: Tone): void => {
    if (!contact || !isActiveContact(contact) || seenContacts.has(contact.id)) return;
    seenContacts.add(contact.id);
    actions.push(callAction(contact, why, rank, tone));
  };

  for (const item of overdue) {
    const contact = item.contactId ? active.find((row) => row.id === item.contactId) : undefined;
    if (contact) {
      const asked = item.notes ? ` ${item.notes}` : '';
      pushContact(contact, `Overdue follow-up (${item.dueDate}).${asked}`, 0, 'red');
    } else {
      actions.push({
        id: `fu-${item.id}`,
        tone: 'red',
        title: item.title,
        detail: item.notes ?? 'Follow-up is overdue.',
        why: `Overdue since ${item.dueDate}`,
        href: '/calls',
        actionLabel: 'Open follow-ups',
        contactId: item.contactId,
        phone: null,
        rank: 0,
      });
    }
  }

  for (const contact of active.filter((item) => item.status === 'Follow Up' && isOverdue(item.nextFollowUpAt, now))) {
    pushContact(contact, `Follow-up overdue (${contact.nextFollowUpAt}).`, 0, 'red');
  }

  for (const item of dueToday) {
    const contact = item.contactId ? active.find((row) => row.id === item.contactId) : undefined;
    const extra = item.notes ? ` ${item.notes}` : '';
    if (contact) pushContact(contact, `Follow-up due today.${extra}`, 1, 'amber');
    else {
      actions.push({
        id: `fu-today-${item.id}`,
        tone: 'amber',
        title: item.title,
        detail: item.notes ?? "Due today.",
        why: "Today's follow-up",
        href: '/calls',
        actionLabel: 'Open',
        contactId: item.contactId,
        phone: null,
        rank: 1,
      });
    }
  }

  for (const contact of active.filter((item) => item.status === 'Follow Up' && isDueToday(item.nextFollowUpAt, now))) {
    pushContact(contact, `Follow-up due today (${contact.nextFollowUpAt}).`, 1, 'amber');
  }

  const highTasks = snapshot.tasks.filter(
    (task) =>
      task.status !== 'Done' &&
      !task.pinKey &&
      (task.priority === 'URGENT' || task.priority === 'HIGH') &&
      (task.dueDate ? isOverdue(task.dueDate, now) || isDueToday(task.dueDate, now) : task.priority === 'URGENT'),
  );
  for (const task of highTasks) {
    actions.push({
      id: `task-${task.id}`,
      tone: task.priority === 'URGENT' ? 'red' : 'amber',
      title: task.title,
      detail: task.notes ?? 'High-priority task.',
      why: task.dueDate && isOverdue(task.dueDate, now) ? `Overdue task (${task.dueDate})` : 'High priority task',
      href: '/tasks',
      actionLabel: 'Open task',
      contactId: task.contactId,
      phone: task.phone,
      rank: 2,
    });
  }

  for (const contact of callQueue(active, now).filter((item) => item.status === 'Call Today')) {
    pushContact(contact, 'Marked Call Today.', 3, 'amber');
  }

  const uncontactedValue = active
    .filter(
      (item) =>
        item.category === 'Underwear/Apparel' &&
        item.status === 'Not Contacted' &&
        (primaryPhone(item) || item.phone),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.organization.localeCompare(b.organization));
  for (const contact of uncontactedValue.slice(0, 8)) {
    pushContact(contact, 'Uncontacted high-value underwear / apparel prospect.', 4, 'indigo');
  }

  const waitingVerification = active.filter(
    (item) =>
      item.category === 'Resources' &&
      (item.verificationStatus === 'Unverified' ||
        item.verificationStatus === 'Research Needed' ||
        item.verificationStatus === 'Needs Correction' ||
        needsReverification(item, now, snapshot.settings)),
  );
  for (const contact of waitingVerification.slice(0, 8)) {
    actions.push({
      id: `verify-${contact.id}`,
      tone: 'amber',
      title: `VERIFY ${contact.organization.toUpperCase()}`,
      detail: `Status: ${contact.verificationStatus}`,
      why: 'Resource waiting for verification.',
      href: `/contacts/${contact.id}`,
      actionLabel: 'Open to verify',
      contactId: contact.id,
      phone: primaryPhone(contact)?.value ?? contact.phone,
      rank: 5,
    });
  }

  for (const contact of active.filter((item) => item.status === 'Left Message' || item.status === 'Called')) {
    pushContact(contact, `Waiting for callback (${contact.status}).`, 6, 'indigo');
  }

  const board = pinned(snapshot.tasks, 'board');
  const boardLeft = snapshot.boardTasks.filter((item) => !item.done).length;
  if (board && board.status !== 'Done' && boardLeft > 0) {
    actions.push({
      id: 'board',
      tone: 'indigo',
      title: 'Board meeting setup',
      detail: `${boardLeft} checklist items remaining.`,
      why: 'Board deadline work is still open.',
      href: '/board',
      actionLabel: 'Open board checklist',
      contactId: null,
      phone: null,
      rank: 7,
    });
  }

  const website = pinned(snapshot.tasks, 'website');
  if (website && website.status !== 'Done') {
    actions.push({
      id: 'website',
      tone: website.status === 'Blocked' ? 'red' : 'indigo',
      title: 'Website 2.0 still needs you',
      detail: website.notes ?? 'Deploy Not By Chance Website 2.0 to production/mainnet.',
      why: 'Website deployment task is still open.',
      href: '/#priority-website',
      actionLabel: 'Open Website 2.0',
      contactId: null,
      phone: null,
      rank: 8,
    });
  }

  const resourcesTask = pinned(snapshot.tasks, 'resources');
  if (resourcesTask && resourcesTask.status !== 'Done' && waitingVerification.length === 0) {
    actions.push({
      id: 'resources-task',
      tone: 'amber',
      title: 'Navigator resource work',
      detail: resourcesTask.notes ?? 'Contact remaining Next Chance Navigator resources.',
      why: 'Website / Navigator operations still have work.',
      href: '/resources',
      actionLabel: 'Open resources',
      contactId: null,
      phone: null,
      rank: 8,
    });
  }

  return actions.sort((a, b) => a.rank - b.rank);
}

export function nextBestAction(snapshot: CommandCenterSnapshot, now: Date = new Date()): RankedAction {
  const ranked = rankNextActions(snapshot, now);
  if (ranked[0]) return ranked[0];
  return {
    id: 'clear',
    tone: 'emerald',
    title: 'The four priorities are clear',
    detail: 'Add a task, a contact, or a follow-up if something new came in.',
    why: 'Nothing is overdue and the operational queues are empty.',
    href: '/tasks',
    actionLabel: 'Add task',
    contactId: null,
    phone: null,
    rank: 99,
  };
}
