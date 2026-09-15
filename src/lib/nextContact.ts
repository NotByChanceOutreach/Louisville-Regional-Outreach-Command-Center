import { isOverdue, todayKey } from './dates.ts';
import type { Contact, ContactStatus } from '../types/models.ts';
import { CALL_QUEUE_STATUSES } from '../types/models.ts';

const CATEGORY_WEIGHT: Record<string, number> = {
  'Underwear/Apparel': 0,
  Resources: 1,
  Partners: 2,
  Donors: 3,
  Board: 4,
  Other: 5,
};

function queueRank(contact: Contact, now: Date): number {
  if (contact.status === 'Call Today') return 0;
  if (contact.status === 'Follow Up' && isOverdue(contact.nextFollowUpAt, now)) return 1;
  if (contact.status === 'Follow Up' && contact.nextFollowUpAt === todayKey(now)) return 2;
  if (contact.status === 'Follow Up') return 3;
  if (contact.status === 'Not Contacted') return 4;
  return 9;
}

export function isInCallQueue(status: ContactStatus): boolean {
  return (CALL_QUEUE_STATUSES as readonly string[]).includes(status);
}

export function callQueue(contacts: readonly Contact[], now: Date = new Date()): Contact[] {
  return contacts
    .filter((contact) => isInCallQueue(contact.status))
    .slice()
    .sort((a, b) => {
      const rank = queueRank(a, now) - queueRank(b, now);
      if (rank !== 0) return rank;
      const cat =
        (CATEGORY_WEIGHT[a.category] ?? 9) - (CATEGORY_WEIGHT[b.category] ?? 9);
      if (cat !== 0) return cat;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.organization.localeCompare(b.organization);
    });
}

export function selectNextContact(
  contacts: readonly Contact[],
  now: Date = new Date(),
  excludeId?: string,
): Contact | null {
  const queue = callQueue(contacts, now);
  const next = queue.find((contact) => contact.id !== excludeId);
  return next ?? null;
}
