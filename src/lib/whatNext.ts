import { isDueToday, isOverdue } from './dates.ts';
import { callQueue } from './nextContact.ts';
import type { CommandCenterSnapshot, PinKey, Task } from './whatNextTypes.ts';

export type { Tone } from './status.ts';
import type { Tone as ToneValue } from './status.ts';

export type NextAction = {
  tone: ToneValue;
  title: string;
  detail: string;
  href: string;
};

function pinned(tasks: readonly Task[], key: PinKey): Task | undefined {
  return tasks.find((task) => task.pinKey === key);
}

export function whatNext(snapshot: CommandCenterSnapshot, now: Date = new Date()): NextAction {
  const overdueFollowUps = snapshot.followUps.filter(
    (item) => item.status === 'open' && isOverdue(item.dueDate, now),
  );
  const overdueContacts = snapshot.contacts.filter(
    (contact) => contact.status === 'Follow Up' && isOverdue(contact.nextFollowUpAt, now),
  );
  const overdueCount = Math.max(overdueFollowUps.length, overdueContacts.length);

  if (overdueCount > 0) {
    return {
      tone: 'red',
      title: overdueCount === 1 ? '1 overdue follow-up' : `${overdueCount} overdue follow-ups`,
      detail: 'Start with the oldest overdue call.',
      href: '/calls/next',
    };
  }

  const callToday = snapshot.contacts.filter((contact) => contact.status === 'Call Today');
  if (callToday.length > 0) {
    return {
      tone: 'amber',
      title: callToday.length === 1 ? '1 call marked for today' : `${callToday.length} calls marked for today`,
      detail: 'Open the next contact and tap Call Now.',
      href: '/calls/next',
    };
  }

  const dueToday = snapshot.followUps.filter(
    (item) => item.status === 'open' && isDueToday(item.dueDate, now),
  );
  const dueContacts = snapshot.contacts.filter(
    (contact) => contact.status === 'Follow Up' && isDueToday(contact.nextFollowUpAt, now),
  );
  const dueCount = Math.max(dueToday.length, dueContacts.length);
  if (dueCount > 0) {
    return {
      tone: 'amber',
      title: dueCount === 1 ? "1 follow-up is due today" : `${dueCount} follow-ups are due today`,
      detail: "Work today's follow-ups before anything else.",
      href: '/calls/next',
    };
  }

  const website = pinned(snapshot.tasks, 'website');
  if (website && website.status !== 'Done') {
    return {
      tone: website.status === 'Blocked' ? 'red' : 'indigo',
      title: 'Website 2.0 still needs you',
      detail: website.notes ?? 'Deploy Not By Chance Website 2.0 to production/mainnet.',
      href: '/#priority-website',
    };
  }

  const remainingResources = snapshot.settings.resourceProgress.remaining;
  if (remainingResources > 0) {
    return {
      tone: 'amber',
      title: `${remainingResources} Navigator resources remaining`,
      detail: 'Open the verifier and work the next record.',
      href: '/resources',
    };
  }

  const underwearLeft = snapshot.contacts.filter(
    (contact) =>
      contact.category === 'Underwear/Apparel' &&
      (contact.status === 'Not Contacted' || contact.status === 'Call Today' || contact.status === 'Follow Up'),
  ).length;
  if (underwearLeft > 0) {
    const next = callQueue(snapshot.contacts, now)[0];
    return {
      tone: 'indigo',
      title: `${underwearLeft} underwear contacts still open`,
      detail: next
        ? `Next: ${next.organization}`
        : 'Start calling manufacturers and distribution centers.',
      href: '/calls/next',
    };
  }

  const boardLeft = snapshot.boardTasks.filter((item) => !item.done).length;
  if (boardLeft > 0) {
    return {
      tone: 'indigo',
      title: `${boardLeft} board meeting steps remaining`,
      detail: 'Set up Microsoft Teams and work down the checklist.',
      href: '/board',
    };
  }

  const openUrgent = snapshot.tasks.filter(
    (task) => task.status !== 'Done' && (task.priority === 'URGENT' || task.priority === 'HIGH'),
  );
  if (openUrgent.length > 0) {
    return {
      tone: openUrgent[0].priority === 'URGENT' ? 'red' : 'amber',
      title: openUrgent[0].title,
      detail: openUrgent[0].notes ?? 'Open tasks still need attention.',
      href: '/tasks',
    };
  }

  return {
    tone: 'emerald',
    title: 'The four priorities are clear',
    detail: 'Add a task or a follow-up if something new came in.',
    href: '/tasks',
  };
}
